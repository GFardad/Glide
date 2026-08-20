import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadGoal, loadAllGoals, persistGoal, } from "./goal-store.js";
export class HeartbeatService {
    options;
    timer;
    iteration = 0;
    stopped = true;
    constructor(options) {
        this.options = options;
    }
    start() {
        if (!this.stopped)
            return;
        this.stopped = false;
        this.iteration = 0;
        this.tick();
        this.timer = setInterval(() => this.tick(), this.options.intervalMs);
    }
    stop() {
        this.stopped = true;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    isRunning() {
        return !this.stopped;
    }
    async tick() {
        if (this.stopped)
            return;
        if (typeof this.options.maxIterations === "number" && this.iteration >= this.options.maxIterations) {
            this.stop();
            return;
        }
        const activeGoals = await this.loadActiveGoals();
        if (typeof this.options.onTick === "function") {
            await this.options.onTick(activeGoals);
        }
        this.iteration += 1;
        this.persistHeartbeatState({
            iteration: this.iteration,
            activeGoals: activeGoals.map((goal) => goal.id),
            lastTickAt: new Date().toISOString(),
        });
    }
    async runScheduledGoals(options) {
        const { expression } = options;
        const intervalMs = options.intervalMs ?? 0;
        const now = new Date();
        const candidates = expression
            ? await this.matchScheduledGoals(options, now)
            : await this.loadDueGoals(options, intervalMs);
        if (candidates.length === 0) {
            return [];
        }
        const reentered = candidates.map((record) => ({
            ...record,
            status: "active",
            updatedAt: now,
            metadata: {
                ...(record.metadata ?? {}),
                lastScheduledAt: now.toISOString(),
            },
        }));
        for (const record of reentered) {
            await persistGoal(options, record);
        }
        if (typeof options.onSchedule === "function") {
            await options.onSchedule(reentered);
        }
        return reentered;
    }
    loadHeartbeatState() {
        const path = join(this.options.root, "heartbeat-state.json");
        if (!existsSync(path)) {
            return undefined;
        }
        return JSON.parse(readFileSync(path, "utf8"));
    }
    async loadActiveGoals() {
        const state = this.loadHeartbeatState();
        if (!state || state.activeGoals.length === 0) {
            return [];
        }
        const loaded = await Promise.all(state.activeGoals.map((id) => loadGoal(this.options, id)));
        return loaded.filter((record) => Boolean(record && record.status === "active"));
    }
    async matchScheduledGoals(options, now) {
        const allGoals = await loadAllGoals(options);
        return allGoals.filter((record) => {
            const metadata = record.metadata ?? {};
            const schedule = metadata.scheduleExpression;
            const lastScheduled = metadata.lastScheduledAt;
            if (!schedule || schedule !== options.expression) {
                return false;
            }
            if (!lastScheduled) {
                return true;
            }
            const lastDate = new Date(lastScheduled);
            const diffMs = now.getTime() - lastDate.getTime();
            return diffMs >= parseDurationToMs(options.expression, diffMs);
        });
    }
    async loadDueGoals(options, intervalMs) {
        const allGoals = await loadAllGoals(options);
        const now = Date.now();
        return allGoals.filter((record) => {
            const updatedAt = record.updatedAt.getTime();
            return record.status === "scheduled" && now - updatedAt >= intervalMs;
        });
    }
    persistHeartbeatState(state) {
        const path = join(this.options.root, "heartbeat-state.json");
        writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
    }
}
function parseDurationToMs(expression, fallbackMs) {
    const match = expression.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match)
        return fallbackMs;
    const value = Number(match[1]);
    const unit = match[2];
    switch (unit) {
        case "ms":
            return value;
        case "s":
            return value * 1000;
        case "m":
            return value * 60 * 1000;
        case "h":
            return value * 60 * 60 * 1000;
        case "d":
            return value * 24 * 60 * 60 * 1000;
        default:
            return fallbackMs;
    }
}
//# sourceMappingURL=heartbeat.js.map