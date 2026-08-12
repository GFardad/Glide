import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { loadCampaign, jsonForScript } from "./generator.js";

/** Default auto-refresh interval (seconds) for the live view. */
export const LIVE_REFRESH_SECONDS = 5;

export type SessionStatus = string;

/**
 * Raw session record persisted at `<campaign_root>/sessions/<session_id>.json`.
 * Field names are snake_case to match the on-disk contract produced by the
 * Glide runtime session manager.
 */
export interface SessionRecord {
  session_id: string;
  objective: string;
  status: SessionStatus;
  cwd: string;
  created_at: string | number | Date;
}

/** A single parsed task line from a session TODO file (`- [ ]` / `- [x]`). */
export interface SessionTask {
  text: string;
  done: boolean;
}

/** A session enriched with its parsed TODO tasks for live rendering. */
export interface LiveSession {
  session_id: string;
  objective: string;
  status: SessionStatus;
  cwd: string;
  createdAt: Date | undefined;
  tasks: SessionTask[];
}

/** Live snapshot of one campaign: its sessions and task state. */
export interface LiveCampaign {
  id: string;
  goal: string;
  root: string;
  sessions: LiveSession[];
  updatedAt: Date;
}

/** Snapshot of all campaigns rendered by the live view. */
export interface LiveView {
  campaigns: LiveCampaign[];
  generatedAt: Date;
  refreshSeconds: number;
}

const TODO_FILENAME = "TODO.md";

/** Coerce an unknown `created_at` value into a Date, tolerating ISO strings and epoch numbers. */
function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && String(numeric) === value.trim()) {
      return new Date(numeric);
    }
  }
  return undefined;
}

/**
 * Parse checkbox task lines from a TODO file body.
 * Supports `- [ ] task` (pending) and `- [x]` / `- [X]` (done).
 */
export function parseSessionTasks(content: string): SessionTask[] {
  const tasks: SessionTask[] = [];
  for (const line of content.split("\n")) {
    const match = /^\s*-\s*\[([ xX])\]\s*(.+)\s*$/.exec(line);
    if (!match) continue;
    const [, marker, text] = match;
    if (marker === undefined || text === undefined) continue;
    tasks.push({ text: text.trim(), done: marker !== " " });
  }
  return tasks;
}

/**
 * Resolve and parse the TODO file for a session.
 * Lookup order: `<sessions>/<session_id>/TODO.md`, `<sessions>/<file-stem>/TODO.md`,
 * then `<session.cwd>/TODO.md` (the runtime workspace convention).
 */
export function loadSessionTasks(
  sessionsDir: string,
  session: SessionRecord,
  sourceFile: string
): SessionTask[] {
  const candidates = [
    join(sessionsDir, session.session_id, TODO_FILENAME),
    join(sessionsDir, basename(sourceFile, ".json"), TODO_FILENAME),
    join(session.cwd, TODO_FILENAME),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return parseSessionTasks(readFileSync(candidate, "utf8"));
    }
  }
  return [];
}

function loadSession(sourceFile: string): LiveSession | undefined {
  try {
    const raw = JSON.parse(
      readFileSync(sourceFile, "utf8")
    ) as Partial<SessionRecord>;
    if (typeof raw.session_id !== "string" || raw.session_id.length === 0) {
      console.error(`[dashboard] session rejected: missing session_id in ${sourceFile}`);
      return undefined;
    }
    const sessionsDir = dirname(sourceFile);
    const session: SessionRecord = {
      session_id: raw.session_id,
      objective: typeof raw.objective === "string" ? raw.objective : "",
      status: typeof raw.status === "string" ? raw.status : "unknown",
      cwd: typeof raw.cwd === "string" ? raw.cwd : "",
      created_at: raw.created_at ?? 0,
    };
    return {
      session_id: session.session_id,
      objective: session.objective,
      status: session.status,
      cwd: session.cwd,
      createdAt: toDate(session.created_at),
      tasks: loadSessionTasks(sessionsDir, session, sourceFile),
    };
  } catch (error) {
    console.error(`[dashboard] failed to load session ${sourceFile}:`, error);
    return undefined;
  }
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "." : path.slice(0, idx);
}

function loadLiveCampaign(root: string): LiveCampaign | undefined {
  if (!existsSync(join(root, "campaign.json"))) return undefined;
  let campaign;
  try {
    campaign = loadCampaign(root);
  } catch (error) {
    console.error(`[dashboard] failed to load campaign ${root}:`, error);
    return undefined;
  }
  const sessionsDir = join(root, "sessions");
  const sessions: LiveSession[] = [];
  if (existsSync(sessionsDir)) {
    for (const name of readdirSync(sessionsDir)) {
      if (!name.endsWith(".json")) continue;
      const session = loadSession(join(sessionsDir, name));
      if (session) sessions.push(session);
    }
  }
  sessions.sort((a, b) => {
    const at = a.createdAt?.getTime() ?? 0;
    const bt = b.createdAt?.getTime() ?? 0;
    return bt - at;
  });
  return {
    id: campaign.id,
    goal: campaign.goal,
    root: campaign.root,
    sessions,
    updatedAt: campaign.updatedAt,
  };
}

/**
 * Build a live snapshot of the given campaign roots:
 * reads `<root>/sessions/*.json` session records and their TODO task files.
 */
export function loadLiveView(campaignRoots: string[]): LiveView {
  const campaigns = campaignRoots
    .map(loadLiveCampaign)
    .filter((c): c is LiveCampaign => c !== undefined)
    .sort((a, b) => latestActivity(b) - latestActivity(a));
  return {
    campaigns,
    generatedAt: new Date(),
    refreshSeconds: LIVE_REFRESH_SECONDS,
  };
}

function latestActivity(campaign: LiveCampaign): number {
  for (const session of campaign.sessions) {
    const created = session.createdAt?.getTime() ?? 0;
    if (created > 0) return created;
  }
  return campaign.updatedAt.getTime();
}

const LIVE_CSS = `
:root {
  color-scheme: light dark;
  --bg: #0f172a;
  --panel-bg: #1e293b;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --border: #334155;
  --accent: #38bdf8;
  --success: #4ade80;
  --warn: #facc15;
  --danger: #f87171;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: radial-gradient(1200px 800px at 10% -10%, rgba(56,189,248,0.15), transparent 60%), radial-gradient(1200px 800px at 90% 110%, rgba(248,113,113,0.12), transparent 60%), var(--bg); color: var(--text); min-height: 100vh; }
header { padding: 22px 24px; border-bottom: 1px solid var(--border); backdrop-filter: blur(6px); background: rgba(15, 23, 42, 0.6); position: sticky; top: 0; z-index: 10; }
header h1 { margin: 0; font-size: 22px; letter-spacing: 0.2px; display: flex; align-items: center; gap: 10px; }
.live-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.6); animation: pulse 2s infinite; display: inline-block; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.6); } 70% { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); } 100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); } }
header p { margin: 6px 0 0; color: var(--muted); font-size: 13px; }
.container { padding: 20px 24px; max-width: 1400px; margin: 0 auto; }
.meta { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 14px; }
.pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel-bg); color: var(--muted); font-size: 12px; }
.pill b { color: var(--text); font-weight: 600; }
.campaign { border: 1px solid var(--border); border-radius: 14px; background: var(--panel-bg); padding: 16px 18px; margin-top: 18px; box-shadow: 0 10px 30px rgba(2, 6, 23, 0.25); }
.campaign h2 { margin: 0 0 4px; font-size: 16px; color: var(--accent); }
.campaign .cid { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; color: var(--muted); font-size: 12px; margin-bottom: 12px; }
.sessions { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; }
.session { border: 1px solid var(--border); border-radius: 12px; background: rgba(15, 23, 42, 0.55); padding: 14px 16px; }
.session .shead { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
.session .sid { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 12px; color: var(--accent); }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid var(--border); color: var(--muted); }
.badge::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.badge-running { color: var(--warn); border-color: rgba(250, 204, 21, 0.45); }
.badge-running::before { animation: pulse 1.6s infinite; }
.badge-done { color: var(--success); border-color: rgba(74, 222, 128, 0.45); }
.badge-failed { color: var(--danger); border-color: rgba(248, 113, 113, 0.45); }
.session .objective { font-size: 14px; line-height: 1.45; margin-bottom: 10px; color: var(--text); }
.session .smeta { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: 11px; color: var(--muted); margin-bottom: 10px; word-break: break-all; }
.tasks { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
.task { display: flex; gap: 8px; padding: 7px 2px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text); }
.task:last-child { border-bottom: none; }
.task .mark { color: var(--muted); }
.task.done .mark { color: var(--success); }
.task.done { color: var(--muted); text-decoration: line-through; }
.no-tasks { margin: 10px 0 0; color: var(--muted); font-size: 12px; font-style: italic; }
.empty { margin-top: 22px; padding: 18px; border: 1px dashed var(--border); border-radius: 14px; color: var(--muted); }
footer { padding: 20px 24px; color: var(--muted); font-size: 12px; }
.skip-link { position: absolute; left: -9999px; top: 0; z-index: 100; padding: 8px 12px; background: var(--accent); color: #082f49; text-decoration: none; border-radius: 0 0 8px 0; }
.skip-link:focus { left: 0; }
`;

const LIVE_SCRIPT = `
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const badgeClass = (status) => {
  if (status === 'running') return 'badge badge-running';
  if (status === 'done') return 'badge badge-done';
  if (status === 'failed') return 'badge badge-failed';
  return 'badge';
};

const renderLive = (view) => {
  const campaigns = view?.campaigns ?? [];
  const sessions = campaigns.flatMap((c) => c.sessions ?? []);
  const count = (status) => sessions.filter((s) => s.status === status).length;
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(
    el('header', {}, [
      el('h1', {}, [el('span', { class: 'live-dot' }), 'Glide Live Session View']),
      el('p', {}, ['Real-time sessions and tasks. Auto-refreshes every ' + view.refreshSeconds + ' seconds.']),
      el('div', { class: 'meta' }, [
        el('span', { class: 'pill' }, [el('b', {}, ['Campaigns']), String(campaigns.length)]),
        el('span', { class: 'pill' }, [el('b', {}, ['Sessions']), String(sessions.length)]),
        el('span', { class: 'pill' }, [el('b', {}, ['Running']), String(count('running'))]),
        el('span', { class: 'pill' }, [el('b', {}, ['Done']), String(count('done'))]),
        el('span', { class: 'pill' }, [el('b', {}, ['Failed']), String(count('failed'))]),
        el('span', { class: 'pill', id: 'refresh-count' }, [el('b', {}, ['Refresh']), 'in ' + view.refreshSeconds + 's']),
        el('span', { class: 'pill' }, [el('b', {}, ['Generated']), formatDate(view.generatedAt)]),
      ]),
    ])
  );
  const container = el('div', { class: 'container' });
  if (!campaigns.length) {
    container.appendChild(el('div', { class: 'empty' }, ['No active campaigns found. Start a Glide campaign to see live sessions here.']));
    root.appendChild(container);
    root.appendChild(el('footer', {}, ['Glide Dashboard · live view']));
    return;
  }
  for (const campaign of campaigns) {
    const section = el('section', { class: 'campaign' });
    section.appendChild(el('h2', {}, [campaign.goal || 'Untitled campaign']));
    section.appendChild(el('div', { class: 'cid' }, [campaign.id]));
    const grid = el('div', { class: 'sessions' });
    for (const session of campaign.sessions ?? []) {
      const card = el('article', { class: 'session' });
      card.appendChild(el('div', { class: 'shead' }, [
        el('span', { class: 'sid' }, [session.session_id]),
        el('span', { class: badgeClass(session.status) }, [session.status]),
      ]));
      card.appendChild(el('div', { class: 'objective' }, [session.objective || '(no objective)']));
      const meta = [session.cwd, session.createdAt ? formatDate(session.createdAt) : 'created unknown'].filter(Boolean).join(' · ');
      card.appendChild(el('div', { class: 'smeta' }, [meta]));
      if (session.tasks?.length) {
        const ul = el('ul', { class: 'tasks' });
        for (const task of session.tasks) {
          ul.appendChild(el('li', { class: task.done ? 'task done' : 'task' }, [
            el('span', { class: 'mark' }, [task.done ? '\\u2611' : '\\u2610']),
            task.text,
          ]));
        }
        card.appendChild(ul);
      } else {
        card.appendChild(el('div', { class: 'no-tasks' }, ['No tasks recorded.']));
      }
      grid.appendChild(card);
    }
    section.appendChild(grid);
    container.appendChild(section);
  }
  root.appendChild(container);
  root.appendChild(el('footer', {}, ['Glide Dashboard · live view']));
};

const view = window.__GLIDE_LIVE__ ?? { campaigns: [], generatedAt: new Date(), refreshSeconds: 5 };
renderLive(view);

let remaining = view.refreshSeconds;
setInterval(() => {
  remaining -= 1;
  const pill = document.getElementById('refresh-count');
  if (pill && remaining > 0) pill.textContent = 'in ' + remaining + 's';
}, 1000);
`;

/**
 * Render a self-contained HTML page for the live session/task view.
 * The page auto-refreshes via `<meta http-equiv="refresh">` every
 * `refreshSeconds` (default 5s), so a periodic regeneration of the file
 * (or any static server re-serving it) yields a real-time view.
 */
export function renderLiveHtml(
  view: LiveView,
  refreshSeconds: number = LIVE_REFRESH_SECONDS
): string {
  const dataJson = jsonForScript({
    campaigns: view.campaigns,
    generatedAt: view.generatedAt.toISOString(),
    refreshSeconds,
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="${refreshSeconds}" />
  <title>Glide Live Session View</title>
  <style>${LIVE_CSS}</style>
</head>
<body>
  <a href="#app" class="skip-link">Skip to content</a>
  <main id="app" aria-live="polite"></main>
  <script>
    window.__GLIDE_LIVE__ = ${dataJson};
  </script>
  <script>${LIVE_SCRIPT}</script>
</body>
</html>`;
}
