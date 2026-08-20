/** Gap classification for plan-vs-codebase assessment. */
export type GapKind = "missing" | "incomplete" | "divergent";
/** Single gap between planned artifact and actual codebase state. */
export interface ConvergeGap {
    kind: GapKind;
    planItem: string;
    actual?: string;
    detail: string;
    suggestion: string;
}
/** Aggregated converge report for a campaign/plan directory. */
export interface ConvergeReport {
    generatedAt: string;
    planDir: string;
    totalGaps: number;
    gapsByKind: Record<GapKind, ConvergeGap[]>;
    actionableTasks: string[];
}
/**
 * Reads Plan/*.md files and extracts high-level plan items.
 * Returns a normalized list of planned components/topics.
 */
export declare function loadPlanItems(planDir: string): string[];
/**
 * Scans the actual codebase under repoRoot and returns a coarse inventory
 * of implemented components: packages, source files, exported symbols,
 * and test files.
 */
export interface CodebaseInventory {
    packages: string[];
    sourceFiles: string[];
    testFiles: string[];
    exportedSymbols: string[];
}
export declare function scanCodebase(repoRoot: string): CodebaseInventory;
/**
 * Compares planned items against the actual codebase inventory and
 * classifies gaps as missing, incomplete, or divergent.
 */
export declare function assessConvergence(planItems: string[], inventory: CodebaseInventory): ConvergeGap[];
/**
 * Generates actionable tasks from the gap list.
 * Each task is a concise instruction suitable for a todo registry.
 */
export declare function actionableTasksFromGaps(gaps: ConvergeGap[]): string[];
/**
 * Full converge assessment: loads plan items, scans codebase, classifies gaps,
 * and returns a report with actionable tasks.
 */
export declare function runConvergeAssessment(repoRoot: string, planDir: string): ConvergeReport;
//# sourceMappingURL=converge.d.ts.map