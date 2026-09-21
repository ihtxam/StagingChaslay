/** Craft.js canvas with no blocks — valid JSON but not publishable homepage content. */
export function isEffectivelyEmptyEditorState(state?: string | null): boolean {
  if (state == null) return true;
  const trimmed = state.trim();
  if (!trimmed || trimmed === '{}') return true;
  try {
    const parsed = JSON.parse(trimmed) as { ROOT?: { nodes?: unknown[] } };
    const nodes = parsed?.ROOT?.nodes;
    return !Array.isArray(nodes) || nodes.length === 0;
  } catch {
    return true;
  }
}
