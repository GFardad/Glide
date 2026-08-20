import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadLatestSnapshot, loadSnapshot, snapshotId, appendHistoryLine } from "./delta.js";
import { loadCampaign, ensureCampaignDir, createCampaign } from "@glide/core";
export class HeadroomRuntime {
    root;
    tracer;
    initialized = false;
    state = null;
    constructor(options) {
        if (typeof options === "string") {
            this.root = options;
        }
        else {
            this.root = options.root;
            this.tracer = options.tracer;
        }
    }
    async initialize(objective) {
        return this.init(objective);
    }
    async init(objective) {
        let campaign;
        if (existsSync(join(this.root, "campaign.json"))) {
            campaign = loadCampaign(this.root);
        }
        else {
            ensureCampaignDir(this.root);
            campaign = createCampaign(this.root, objective, [], []);
        }
        const state = this.toState(campaign);
        const snapshot = this.buildSnapshot(campaign);
        appendHistoryLine(this.root, JSON.stringify(snapshot));
        this.state = {
            ...state,
            snapshot,
        };
        this.initialized = true;
        return this.state;
    }
    start() {
        this.initialized = true;
    }
    stop() {
        this.initialized = false;
        this.state = null;
    }
    dispose() {
        this.stop();
    }
    isInitialized() {
        return this.initialized;
    }
    getState() {
        return this.state;
    }
    applyDelta(delta) {
        const current = loadLatestSnapshot(this.root) ?? this.emptySnapshot();
        const nextState = applyOperations(current.state, delta.operations);
        const snapshot = {
            id: snapshotId(),
            timestamp: new Date().toISOString(),
            state: nextState,
            deltaHistory: [...current.deltaHistory, delta],
        };
        appendHistoryLine(this.root, JSON.stringify(snapshot));
        if (this.state) {
            this.state = {
                ...this.state,
                snapshot,
            };
        }
        const sessionId = this.state?.campaign.id;
        void this.tracer?.log({ action: "headroom.apply_delta", status: "ok", detail: snapshot.id }, sessionId ? { sessionId } : undefined);
        return snapshot;
    }
    rollback(snapshotId) {
        const target = loadSnapshot(this.root, snapshotId);
        if (!target) {
            throw new Error(`Snapshot not found: ${snapshotId}`);
        }
        appendHistoryLine(this.root, JSON.stringify(target));
        if (this.state) {
            this.state = {
                ...this.state,
                snapshot: target,
            };
        }
        return target;
    }
    loadLatestSnapshot() {
        return loadLatestSnapshot(this.root);
    }
    toState(campaign) {
        const createdAt = toIso(campaign.createdAt);
        const updatedAt = toIso(campaign.updatedAt);
        return {
            campaign: {
                id: campaign.id,
                root: campaign.root,
                goal: campaign.goal,
                nonGoals: campaign.nonGoals,
                assumptions: campaign.assumptions,
                createdAt,
                updatedAt,
            },
            snapshot: undefined,
        };
    }
    buildSnapshot(campaign) {
        const createdAt = toIso(campaign.createdAt);
        const updatedAt = toIso(campaign.updatedAt);
        const record = {
            id: campaign.id,
            goal: campaign.goal,
            status: "active",
            createdAt,
            updatedAt,
        };
        return {
            id: snapshotId(),
            timestamp: new Date().toISOString(),
            state: [record],
            deltaHistory: [],
        };
    }
    emptySnapshot() {
        return {
            id: snapshotId(),
            timestamp: new Date().toISOString(),
            state: [],
            deltaHistory: [],
        };
    }
}
function applyOperations(state, operations) {
    const next = [...state];
    for (const op of operations) {
        if (op.kind === "add") {
            next.push({
                id: op.goalId,
                campaignId: op.campaignId,
                goal: op.goal ?? "",
                status: "active",
                source: undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                metadata: op.metadata,
            });
        }
        else if (op.kind === "update") {
            const index = next.findIndex((item) => item.id === op.goalId);
            if (index >= 0) {
                const current = next[index];
                const mergedMetadata = { ...(current.metadata ?? {}), ...(op.metadata ?? {}) };
                next[index] = {
                    ...current,
                    goal: op.goal ?? "",
                    updatedAt: new Date().toISOString(),
                    metadata: mergedMetadata,
                };
            }
        }
        else if (op.kind === "delete") {
            const index = next.findIndex((item) => item.id === op.goalId);
            if (index >= 0) {
                next.splice(index, 1);
            }
        }
    }
    return next;
}
function toIso(value) {
    if (value instanceof Date)
        return value.toISOString();
    return value ?? new Date().toISOString();
}
//# sourceMappingURL=runtime.js.map