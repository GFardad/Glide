import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCampaign } from "../packages/core/src/campaign/index.js";
import {
  LIVE_REFRESH_SECONDS,
  loadLiveView,
  parseSessionTasks,
  renderLiveHtml,
} from "../packages/dashboard/src/live.js";

describe("dashboard live view", () => {
  const tmpRoot = "/tmp/glide-dashboard-live-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  function writeSession(
    campaignRoot: string,
    session: {
      session_id: string;
      objective?: string;
      status?: string;
      cwd?: string;
      created_at?: string;
    }
  ): void {
    const sessionsDir = join(campaignRoot, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(
      join(sessionsDir, `${session.session_id}.json`),
      JSON.stringify(
        {
          session_id: session.session_id,
          objective: session.objective ?? "Run the campaign",
          status: session.status ?? "running",
          cwd: session.cwd ?? join(campaignRoot, "workspace"),
          created_at: session.created_at ?? "2026-08-11T10:00:00.000Z",
        },
        null,
        2
      )
    );
  }

  function writeTodos(
    campaignRoot: string,
    sessionId: string,
    lines: string[]
  ): void {
    const dir = join(campaignRoot, "sessions", sessionId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "TODO.md"), `${lines.join("\n")}\n`);
  }

  it("parses checkbox tasks from TODO file content", () => {
    const tasks = parseSessionTasks(
      [
        "# TODO",
        "",
        "- [ ] Write the live view",
        "- [x] Wire status badges",
        "- [X] Ship dashboard",
        "just a note, not a task",
      ].join("\n")
    );
    expect(tasks).toEqual([
      { text: "Write the live view", done: false },
      { text: "Wire status badges", done: true },
      { text: "Ship dashboard", done: true },
    ]);
  });

  it("loads live sessions with statuses and tasks from campaign roots", () => {
    const root = join(tmpRoot, "c1");
    createCampaign(
      root,
      "Build live dashboard",
      ["Static UI"],
      ["sessions exist"]
    );
    writeSession(root, {
      session_id: "sess_running",
      objective: "Emit live HTML",
      status: "running",
      created_at: "2026-08-11T12:00:00.000Z",
    });
    writeTodos(root, "sess_running", [
      "- [ ] Render sessions",
      "- [ ] Auto-refresh",
    ]);
    writeSession(root, {
      session_id: "sess_done",
      objective: "Backfill artifacts",
      status: "done",
      created_at: "2026-08-11T11:00:00.000Z",
    });
    writeTodos(root, "sess_done", ["- [x] Backfill done"]);
    writeSession(root, {
      session_id: "sess_failed",
      objective: "Ship release",
      status: "failed",
      created_at: "2026-08-11T10:00:00.000Z",
    });

    const view = loadLiveView([root, join(tmpRoot, "missing")]);
    expect(view.campaigns).toHaveLength(1);

    const campaign = view.campaigns[0];
    expect(campaign?.id).toBeTruthy();
    expect(campaign?.goal).toBe("Build live dashboard");

    const byId = new Map(
      campaign?.sessions.map((s) => [s.session_id, s]) ?? []
    );
    expect(byId.get("sess_running")?.status).toBe("running");
    expect(byId.get("sess_done")?.status).toBe("done");
    expect(byId.get("sess_failed")?.status).toBe("failed");

    const running = byId.get("sess_running");
    expect(running?.tasks).toEqual([
      { text: "Render sessions", done: false },
      { text: "Auto-refresh", done: false },
    ]);
    expect(byId.get("sess_done")?.tasks).toEqual([
      { text: "Backfill done", done: true },
    ]);
    expect(byId.get("sess_failed")?.tasks).toEqual([]);

    // Newest session first.
    const ids = campaign?.sessions.map((s) => s.session_id);
    expect(ids).toEqual(["sess_running", "sess_done", "sess_failed"]);
    expect(view.refreshSeconds).toBe(LIVE_REFRESH_SECONDS);
  });

  it("falls back to the session cwd for TODO files", () => {
    const root = join(tmpRoot, "c2");
    createCampaign(root, "Cwd todos", [], []);
    const ws = join(root, "workspace");
    mkdirSync(ws, { recursive: true });
    writeFileSync(join(ws, "TODO.md"), "- [ ] Task from cwd\n");
    writeSession(root, {
      session_id: "sess_cwd",
      objective: "Use workspace",
      cwd: ws,
    });

    const view = loadLiveView([root]);
    const session = view.campaigns[0]?.sessions[0];
    expect(session?.tasks).toEqual([{ text: "Task from cwd", done: false }]);
  });

  it("renders live HTML with status badges, tasks, and refresh meta tag", () => {
    const root = join(tmpRoot, "c3");
    createCampaign(root, "Render live view", [], []);
    writeSession(root, {
      session_id: "sess_running",
      objective: "Emit live HTML",
      status: "running",
      created_at: "2026-08-11T12:00:00.000Z",
    });
    writeTodos(root, "sess_running", ["- [ ] Render sessions"]);
    writeSession(root, {
      session_id: "sess_done",
      objective: "Backfill artifacts",
      status: "done",
      created_at: "2026-08-11T11:00:00.000Z",
    });
    writeSession(root, {
      session_id: "sess_failed",
      objective: "Ship release",
      status: "failed",
      created_at: "2026-08-11T10:00:00.000Z",
    });

    const html = renderLiveHtml(loadLiveView([root]));

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Glide Live Session View</title>");
    expect(html).toContain('<meta http-equiv="refresh" content="5" />');
    expect(html).toContain("window.__GLIDE_LIVE__");

    // Session identifiers and objectives.
    expect(html).toContain("sess_running");
    expect(html).toContain("sess_done");
    expect(html).toContain("sess_failed");

    // Status badges.
    expect(html).toContain("badge-running");
    expect(html).toContain("badge-done");
    expect(html).toContain("badge-failed");

    // Task listing (parsed from TODO.md).
    expect(html).toContain("Render sessions");
    expect(html).toContain("No active campaigns");
  });

  it("renders an empty live view when no campaigns exist", () => {
    const view = loadLiveView([join(tmpRoot, "missing")]);
    expect(view.campaigns).toEqual([]);
    expect(view.generatedAt).toBeInstanceOf(Date);

    const html = renderLiveHtml(view, LIVE_REFRESH_SECONDS);
    expect(html).toContain("No active campaigns found");
    expect(html).toContain('<meta http-equiv="refresh" content="5" />');
  });

  it("honors a custom refresh interval in the meta tag", () => {
    const html = renderLiveHtml(
      { campaigns: [], generatedAt: new Date(), refreshSeconds: 5 },
      10
    );
    expect(html).toContain('<meta http-equiv="refresh" content="10" />');
  });
});
