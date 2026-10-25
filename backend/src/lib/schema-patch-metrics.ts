/**
 * In-process counters for idempotent schema patches.
 * Repeated full ensure* runs in one process usually mean a hot-path bug or promise reset.
 */

const ensureRunCounts = new Map<string, number>();
const columnPatchCounts = new Map<string, number>();

let duplicateEnsureWarned = new Set<string>();
let duplicateColumnWarned = new Set<string>();

function warnOnce(kind: "ensure" | "column", key: string, count: number, detail: string) {
  const seen = kind === "ensure" ? duplicateEnsureWarned : duplicateColumnWarned;
  if (seen.has(key)) return;
  seen.add(key);
  console.warn(`[schema-metrics] ${detail} (count=${count})`);
}

/** Called when a memoized ensure* function starts a new run (promise was null). */
export function recordSchemaEnsureRun(name: string): void {
  const next = (ensureRunCounts.get(name) ?? 0) + 1;
  ensureRunCounts.set(name, next);
  if (next > 1) {
    warnOnce(
      "ensure",
      name,
      next,
      `Schema ensure "${name}" started again in the same API process — check for promise resets or per-request calls`
    );
  }
}

/** Called when runPatch actually executes SQL (not when skipped via patchedColumns cache). */
export function recordSchemaColumnPatch(cacheKey: string): void {
  const next = (columnPatchCounts.get(cacheKey) ?? 0) + 1;
  columnPatchCounts.set(cacheKey, next);
  if (next > 1) {
    warnOnce(
      "column",
      cacheKey,
      next,
      `Column patch "${cacheKey}" executed more than once in the same API process`
    );
  }
}

export type SchemaPatchMetricsSnapshot = {
  ensureRuns: Record<string, number>;
  columnPatches: Record<string, number>;
  duplicateEnsureKeys: string[];
  duplicateColumnKeys: string[];
};

export function getSchemaPatchMetrics(): SchemaPatchMetricsSnapshot {
  const ensureRuns: Record<string, number> = {};
  for (const [k, v] of ensureRunCounts) ensureRuns[k] = v;

  const columnPatches: Record<string, number> = {};
  for (const [k, v] of columnPatchCounts) columnPatches[k] = v;

  return {
    ensureRuns,
    columnPatches,
    duplicateEnsureKeys: [...ensureRunCounts.entries()]
      .filter(([, n]) => n > 1)
      .map(([k]) => k),
    duplicateColumnKeys: [...columnPatchCounts.entries()]
      .filter(([, n]) => n > 1)
      .map(([k]) => k),
  };
}
