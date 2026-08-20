import { existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicAppendFileSync } from "@glide/core";
export function resetGoalStoreCache() {
    // no-op for file-backed store
}
function resolveDatabase(options) {
    if (options.database) {
        return options.database;
    }
    return createFileDatabase(options.root);
}
function createFileDatabase(root) {
    const goalsPath = join(root, "goals.json");
    function load() {
        if (!existsSync(goalsPath)) {
            return [];
        }
        return JSON.parse(readFileSync(goalsPath, "utf8"));
    }
    return {
        prepare() {
            return {
                run() {
                    return { changes: 1 };
                },
                get() {
                    return undefined;
                },
                all() {
                    return load();
                },
            };
        },
        exec() {
            if (!existsSync(goalsPath)) {
                mkdirSync(root, { recursive: true });
                writeFileSync(goalsPath, "[]", "utf8");
            }
        },
    };
}
export function createGoalRecord(text, options) {
    const now = new Date();
    return {
        id: options?.id ?? nanoid(),
        campaignId: options?.campaignId,
        goal: text,
        status: options?.status ?? "active",
        source: options?.source,
        createdAt: options?.createdAt instanceof Date ? options.createdAt : (options?.createdAt ? new Date(options.createdAt) : now),
        updatedAt: options?.updatedAt instanceof Date ? options.updatedAt : (options?.updatedAt ? new Date(options.updatedAt) : now),
        metadata: options?.metadata,
    };
}
export async function persistGoal(options, record) {
    const db = resolveDatabase(options);
    db.exec();
    const goalsPath = join(options.root, "goals.json");
    let goals = [];
    if (existsSync(goalsPath)) {
        goals = JSON.parse(readFileSync(goalsPath, "utf8"));
    }
    const existing = goals.find((g) => g.id === record.id);
    if (existing) {
        existing.status = record.status;
        existing.updated_at = record.updatedAt.toISOString();
        existing.metadata = record.metadata ? JSON.stringify(record.metadata) : null;
    }
    else {
        goals.push({
            id: record.id,
            campaign_id: record.campaignId,
            goal: record.goal,
            status: record.status,
            source: record.source,
            created_at: record.createdAt.toISOString(),
            updated_at: record.updatedAt.toISOString(),
            metadata: record.metadata ? JSON.stringify(record.metadata) : null,
        });
    }
    mkdirSync(options.root, { recursive: true });
    writeFileSync(goalsPath, JSON.stringify(goals, null, 2), "utf8");
    return record;
}
export async function loadGoal(options, id) {
    const goalsPath = join(options.root, "goals.json");
    if (!existsSync(goalsPath)) {
        return undefined;
    }
    const goals = JSON.parse(readFileSync(goalsPath, "utf8"));
    const row = goals.find((g) => g.id === id);
    if (!row)
        return undefined;
    return {
        id: row.id,
        campaignId: row.campaign_id,
        goal: row.goal,
        status: row.status,
        source: row.source ?? undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
}
export async function loadGoalsByCampaign(options, campaignId) {
    const goalsPath = join(options.root, "goals.json");
    if (!existsSync(goalsPath)) {
        return [];
    }
    const goals = JSON.parse(readFileSync(goalsPath, "utf8"));
    return goals
        .filter((row) => row.campaign_id === campaignId)
        .map((row) => ({
        id: row.id,
        campaignId: row.campaign_id,
        goal: row.goal,
        status: row.status,
        source: row.source ?? undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
}
export async function updateGoalStatus(options, id, status) {
    const goalsPath = join(options.root, "goals.json");
    if (!existsSync(goalsPath)) {
        return undefined;
    }
    const goals = JSON.parse(readFileSync(goalsPath, "utf8"));
    const existing = goals.find((g) => g.id === id);
    if (!existing)
        return undefined;
    existing.status = status;
    existing.updated_at = new Date().toISOString();
    mkdirSync(options.root, { recursive: true });
    writeFileSync(goalsPath, JSON.stringify(goals, null, 2), "utf8");
    return loadGoal(options, id);
}
export async function loadActiveGoals(options) {
    const all = await loadAllGoals(options);
    return all.filter((record) => record.status === "active");
}
export async function loadAllGoals(options) {
    const goalsPath = join(options.root, "goals.json");
    if (!existsSync(goalsPath)) {
        return [];
    }
    const goals = JSON.parse(readFileSync(goalsPath, "utf8"));
    return goals.map((row) => ({
        id: row.id,
        campaignId: row.campaign_id,
        goal: row.goal,
        status: row.status,
        source: row.source ?? undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
}
export function writeGoalSnapshot(options, records) {
    const path = join(options.root, "goal-snapshot.json");
    writeFileSync(path, JSON.stringify(records, null, 2), "utf8");
}
export function readGoalSnapshot(options) {
    const path = join(options.root, "goal-snapshot.json");
    if (!existsSync(path)) {
        return [];
    }
    return JSON.parse(readFileSync(path, "utf8"));
}
export function appendGoalJsonl(options, record) {
    const path = join(options.root, "goals.jsonl");
    const line = JSON.stringify({ ...record, _ts: Date.now() }) + "\n";
    if (!existsSync(path)) {
        mkdirSync(options.root, { recursive: true });
    }
    atomicAppendFileSync(path, line);
}
export function readGoalJsonl(options) {
    const path = join(options.root, "goals.jsonl");
    if (!existsSync(path)) {
        return [];
    }
    const content = readFileSync(path, "utf8");
    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    return lines.map((line) => JSON.parse(line));
}
export function runScheduledGoals() {
    // Placeholder for scheduled goal execution.
}
function nanoid(size = 21) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < size; i++) {
        id += alphabet[bytes[i] % alphabet.length];
    }
    return id;
}
//# sourceMappingURL=goal-store.js.map