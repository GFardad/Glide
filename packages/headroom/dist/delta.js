import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
const DEFAULT_SNAPSHOT_DIR = ".glide-headroom/snapshots";
const HISTORY_FILE = "history.jsonl";
export function resolveSnapshotDir(root) {
    return join(root, DEFAULT_SNAPSHOT_DIR);
}
export function resolveHistoryPath(root) {
    return join(resolveSnapshotDir(root), HISTORY_FILE);
}
export function ensureSnapshotDir(root) {
    const dir = resolveSnapshotDir(root);
    mkdirSync(dir, { recursive: true });
    return dir;
}
export function snapshotId() {
    return `snapshot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
export function appendHistoryLine(root, line) {
    const path = resolveHistoryPath(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, line + "\n", { flag: "a" });
}
export function readHistoryLines(root) {
    const path = resolveHistoryPath(root);
    if (!existsSync(path)) {
        return [];
    }
    const raw = readFileSync(path, "utf8");
    return raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}
export function writeSnapshot(snapshot, root) {
    const path = resolveHistoryPath(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot) + "\n", { flag: "a" });
    return path;
}
export function loadLatestSnapshot(root) {
    const lines = readHistoryLines(root);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
            const parsed = JSON.parse(lines[i]);
            if (parsed && parsed.id && parsed.timestamp && Array.isArray(parsed.state)) {
                return parsed;
            }
        }
        catch {
            // skip malformed lines
        }
    }
    return undefined;
}
export function loadSnapshot(root, id) {
    const lines = readHistoryLines(root);
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            if (parsed.id === id) {
                return parsed;
            }
        }
        catch {
            // skip malformed lines
        }
    }
    return undefined;
}
export function listSnapshotIds(root) {
    const lines = readHistoryLines(root);
    const ids = [];
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            if (parsed && parsed.id && !ids.includes(parsed.id)) {
                ids.push(parsed.id);
            }
        }
        catch {
            // skip malformed lines
        }
    }
    return ids;
}
export function recordToSnapshot(record) {
    return {
        id: record.id,
        campaignId: record.campaignId ?? undefined,
        goal: record.goal,
        status: record.status,
        source: record.source,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        metadata: record.metadata,
    };
}
//# sourceMappingURL=delta.js.map