import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HeadroomDelta, HeadroomSnapshot, GoalRecordSnapshot, HeadroomDeltaOperation } from "./delta.js";
import { loadLatestSnapshot, loadSnapshot, snapshotId, appendHistoryLine } from "./delta.js";
import { loadCampaign, ensureCampaignDir, createCampaign } from "@glide/core";

/**
 * Represents a loaded campaign together with its goal history context.
 */
export interface HeadroomRuntimeState {
  campaign: {
    id: string;
    root: string;
    goal: string;
    nonGoals: string[];
    assumptions: string[];
    createdAt: string;
    updatedAt: string;
  };
  snapshot: HeadroomSnapshot | undefined;
}

/**
 * Evidence-backed runtime for headroom deltas with snapshot/rollback support.
 */
export class HeadroomRuntime {
  constructor(private root: string) {}

  async initialize(objective: string): Promise<HeadroomRuntimeState> {
    let campaign;
    if (existsSync(join(this.root, "campaign.json"))) {
      campaign = loadCampaign(this.root);
    } else {
      ensureCampaignDir(this.root);
      campaign = createCampaign(this.root, objective, [], []);
    }

    const state = this.toState(campaign);
    const snapshot = this.buildSnapshot(campaign);
    appendHistoryLine(this.root, JSON.stringify(snapshot));

    return {
      ...state,
      snapshot,
    };
  }

  /**
   * Applies a delta to the runtime state and persists it as a new snapshot.
   */
  applyDelta(delta: HeadroomDelta): HeadroomSnapshot {
    const current = loadLatestSnapshot(this.root) ?? this.emptySnapshot();
    const nextState = applyOperations(current.state, delta.operations);
    const snapshot: HeadroomSnapshot = {
      id: snapshotId(),
      timestamp: new Date().toISOString(),
      state: nextState,
      deltaHistory: [...current.deltaHistory, delta],
    };

    appendHistoryLine(this.root, JSON.stringify(snapshot));
    return snapshot;
  }

  /**
   * Rolls back to a previous snapshot by id.
   */
  rollback(snapshotId: string): HeadroomSnapshot {
    const target = loadSnapshot(this.root, snapshotId);
    if (!target) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    appendHistoryLine(this.root, JSON.stringify(target));
    return target;
  }

  /**
   * Loads the latest snapshot from history.
   */
  loadLatestSnapshot(): HeadroomSnapshot | undefined {
    return loadLatestSnapshot(this.root);
  }

  private toState(campaign: ReturnType<typeof loadCampaign>): HeadroomRuntimeState {
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

  private buildSnapshot(campaign: ReturnType<typeof loadCampaign>): HeadroomSnapshot {
    const createdAt = toIso(campaign.createdAt);
    const updatedAt = toIso(campaign.updatedAt);
    const record: GoalRecordSnapshot = {
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

  private emptySnapshot(): HeadroomSnapshot {
    return {
      id: snapshotId(),
      timestamp: new Date().toISOString(),
      state: [],
      deltaHistory: [],
    };
  }
}

function toIso(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function applyOperations(
  state: GoalRecordSnapshot[],
  operations: HeadroomDeltaOperation[]
): GoalRecordSnapshot[] {
  const map = new Map(state.map((item) => [item.id, item]));

  for (const operation of operations) {
    switch (operation.kind) {
      case "add":
        if (!map.has(operation.goalId)) {
          map.set(operation.goalId, {
            id: operation.goalId,
            campaignId: operation.campaignId,
            goal: operation.goal ?? "",
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: operation.metadata,
            source: undefined,
          });
        }
        break;
      case "update": {
        const existing = map.get(operation.goalId);
        if (existing) {
          map.set(operation.goalId, {
            ...existing,
            goal: operation.goal ?? existing.goal,
            updatedAt: new Date().toISOString(),
            metadata: operation.metadata ?? existing.metadata,
          });
        }
        break;
      }
      case "delete":
        map.delete(operation.goalId);
        break;
    }
  }

  return Array.from(map.values());
}
