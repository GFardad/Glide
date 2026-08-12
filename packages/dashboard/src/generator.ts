import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export interface DashboardArtifact {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
}

export interface CampaignListing {
  id: string;
  goal: string;
  updatedAt: Date;
  artifactCount: number;
  sessionCount: number;
}

export interface DashboardView {
  campaigns: CampaignListing[];
  generatedAt: Date;
}

export interface Campaign {
  id: string;
  root: string;
  goal: string;
  nonGoals: string[];
  assumptions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function loadCampaign(root: string): Campaign {
  const constitutionPath = join(root, "campaigns", "constitution.json");
  const legacyPath = join(root, "campaign.json");
  const path = existsSync(constitutionPath) ? constitutionPath : legacyPath;
  if (!existsSync(path)) {
    throw new Error(`Campaign not found: ${root}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `Malformed campaign JSON at ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  const campaign =
    data && typeof data === "object" && "campaign" in data
      ? (data as { campaign?: unknown }).campaign
      : data;
  if (!campaign || typeof campaign !== "object") {
    throw new Error(`Campaign not found: ${root}`);
  }
  const c = campaign as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : "";
  const goal = typeof c.goal === "string" ? c.goal : "";
  const nonGoals = Array.isArray(c.nonGoals)
    ? c.nonGoals.filter((x): x is string => typeof x === "string")
    : [];
  const assumptions = Array.isArray(c.assumptions)
    ? c.assumptions.filter((x): x is string => typeof x === "string")
    : [];
  return {
    id,
    root,
    goal,
    nonGoals,
    assumptions,
    createdAt: toDate(c.createdAt) ?? new Date(0),
    updatedAt: toDate(c.updatedAt) ?? new Date(0),
  } satisfies Campaign;
}

/** Coerce an unknown value into a Date, tolerating ISO strings and epoch numbers. */
function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function listArtifacts(root: string): DashboardArtifact[] {
  const artifactsDir = join(root, "artifacts");
  if (!existsSync(artifactsDir)) {
    return [];
  }
  return readdirSync(artifactsDir)
    .map((name) => {
      const path = join(artifactsDir, name);
      const stats = statSync(path);
      return {
        name,
        path,
        size: stats.size,
        modifiedAt: new Date(stats.mtimeMs),
      } satisfies DashboardArtifact;
    })
    .filter((item) => item.name !== "role_analysis.json");
}

function listSessions(root: string): number {
  const sessionsDir = join(root, "sessions");
  if (!existsSync(sessionsDir)) {
    return 0;
  }
  return readdirSync(sessionsDir).length;
}

function buildCampaignListing(root: string): CampaignListing {
  const campaign = loadCampaign(root);
  const artifacts = listArtifacts(root);
  return {
    id: campaign.id,
    goal: campaign.goal,
    updatedAt: campaign.updatedAt,
    artifactCount: artifacts.length,
    sessionCount: listSessions(root),
  };
}

export function listCampaigns(roots: string[]): CampaignListing[] {
  return roots
    .filter((root) => existsSync(join(root, "campaign.json")) || existsSync(join(root, "campaigns", "constitution.json")))
    .map(buildCampaignListing)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export function generateDashboard(campaignRoots: string[]): DashboardView {
  return {
    campaigns: listCampaigns(campaignRoots),
    generatedAt: new Date(),
  };
}

const CSS = `
:root {
  color-scheme: light dark;
  --bg: #0f172a;
  --panel-bg: #1e293b;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --border: #334155;
  --accent: #38bdf8;
  --accent-dark: #0ea5e9;
  --success: #4ade80;
  --warn: #facc15;
  --danger: #f87171;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: radial-gradient(1200px 800px at 10% -10%, rgba(56,189,248,0.15), transparent 60%), radial-gradient(1200px 800px at 90% 110%, rgba(248,113,113,0.12), transparent 60%), var(--bg); color: var(--text); min-height: 100vh; }
header { padding: 22px 24px; border-bottom: 1px solid var(--border); backdrop-filter: blur(6px); background: rgba(15, 23, 42, 0.6); position: sticky; top: 0; z-index: 10; }
header h1 { margin: 0; font-size: 22px; letter-spacing: 0.2px; }
header p { margin: 6px 0 0; color: var(--muted); font-size: 13px; }
.container { padding: 20px 24px; max-width: 1400px; margin: 0 auto; }
.meta { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 14px; }
.pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel-bg); color: var(--muted); font-size: 12px; }
.pill b { color: var(--text); font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 18px; }
.card { border: 1px solid var(--border); border-radius: 14px; background: var(--panel-bg); padding: 16px 18px; box-shadow: 0 10px 30px rgba(2, 6, 23, 0.25); transition: transform 0.08s ease, border-color 0.2s ease; }
.card:hover { transform: translateY(-1px); border-color: var(--accent-dark); }
.card h2 { margin: 0 0 6px; font-size: 16px; color: var(--accent); }
.card .id { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; color: var(--muted); font-size: 12px; margin-bottom: 10px; }
.kv { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-top: 1px solid var(--border); color: var(--muted); font-size: 13px; }
.kv b { color: var(--text); font-weight: 600; }
.empty { margin-top: 22px; padding: 18px; border: 1px dashed var(--border); border-radius: 14px; color: var(--muted); }
footer { padding: 20px 24px; color: var(--muted); font-size: 12px; }
.skip-link { position: absolute; left: -9999px; top: 0; z-index: 100; padding: 8px 12px; background: var(--accent); color: #082f49; text-decoration: none; border-radius: 0 0 8px 0; }
.skip-link:focus { left: 0; }
`;

const SCRIPT = `
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

const renderDashboard = (view) => {
  const campaigns = view?.campaigns ?? [];
  const totalCampaigns = campaigns.length;
  const totalArtifacts = campaigns.reduce((sum, c) => sum + (c.artifactCount ?? 0), 0);
  const totalSessions = campaigns.reduce((sum, c) => sum + (c.sessionCount ?? 0), 0);
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(
    el('header', {}, [
      el('h1', {}, ['Glide Virtual Office']),
      el('p', {}, ['Real-time campaign and task surface for active Glide runs.']),
      el('div', { class: 'meta' }, [
        el('span', { class: 'pill' }, [el('b', {}, ['Campaigns']), String(totalCampaigns)]),
        el('span', { class: 'pill' }, [el('b', {}, ['Artifacts']), String(totalArtifacts)]),
        el('span', { class: 'pill' }, [el('b', {}, ['Sessions']), String(totalSessions)]),
        el('span', { class: 'pill' }, [el('b', {}, ['Generated']), formatDate(view.generatedAt)]),
      ]),
    ])
  );
  const container = el('div', { class: 'container' });
  if (!totalCampaigns) {
    container.appendChild(el('div', { class: 'empty' }, ['No campaigns found. Create a campaign directory with a campaign.json to see it here.']));
    root.appendChild(container);
    root.appendChild(el('footer', {}, ['Glide Dashboard']));
    return;
  }
  const grid = el('div', { class: 'grid' });
  for (const campaign of campaigns) {
    const card = el('div', { class: 'card' });
    card.appendChild(el('h2', {}, [campaign.goal || 'Untitled campaign']));
    card.appendChild(el('div', { class: 'id' }, [campaign.id]));
    card.appendChild(el('div', { class: 'kv' }, [el('b', {}, ['Updated']), formatDate(campaign.updatedAt)]));
    card.appendChild(el('div', { class: 'kv' }, [el('b', {}, ['Artifacts']), String(campaign.artifactCount)]));
    card.appendChild(el('div', { class: 'kv' }, [el('b', {}, ['Sessions']), String(campaign.sessionCount)]));
    grid.appendChild(card);
  }
  container.appendChild(grid);
  root.appendChild(container);
  root.appendChild(el('footer', {}, ['Glide Dashboard']));
};

const view = (window.__GLIDE_DASHBOARD__ ?? { campaigns: [], generatedAt: new Date() });
renderDashboard(view);
`;

export function renderHtml(view: DashboardView): string {
  const campaignsJson = jsonForScript({
    campaigns: view.campaigns,
    generatedAt: view.generatedAt.toISOString(),
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Glide Dashboard</title>
  <style>${CSS}</style>
</head>
<body>
  <a href="#app" class="skip-link">Skip to content</a>
  <main id="app" aria-live="polite"></main>
  <script>
    window.__GLIDE_DASHBOARD__ = ${campaignsJson};
  </script>
  <script>${SCRIPT}</script>
</body>
</html>`;
}

/**
 * Serialize a value into a `<script>`-safe JSON literal, neutralizing any
 * sequence that could break out of the script context (`</script>`, HTML
 * entities, and U+2028/U+2029 line separators). This prevents stored XSS when
 * user-derived campaign/session fields are embedded into rendered HTML.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
