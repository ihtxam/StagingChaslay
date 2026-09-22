/** Craft.js canvas with no blocks — valid JSON but not publishable homepage content. */
export function isEffectivelyEmptyEditorState(state?: string | null): boolean {
  if (state == null) return true;
  const trimmed = state.trim();
  if (!trimmed || trimmed === "{}") return true;
  try {
    const parsed = JSON.parse(trimmed) as { ROOT?: { nodes?: unknown[] } };
    const nodes = parsed?.ROOT?.nodes;
    return !Array.isArray(nodes) || nodes.length === 0;
  } catch {
    return true;
  }
}

export function normalizeEditorState(state?: string | null): string | null {
  if (state == null) return null;
  const trimmed = state.trim();
  if (!trimmed || trimmed === "{}") return null;
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

/** Prefer page row when it has blocks; otherwise fall back to builder snapshot. */
export function pickPublishedEditorState(
  pageState: string | null,
  builderState: string | null
): string | null {
  const fromPage = normalizeEditorState(pageState);
  const fromBuilder = normalizeEditorState(builderState);
  const pageHasContent = fromPage && !isEffectivelyEmptyEditorState(fromPage);
  const builderHasContent = fromBuilder && !isEffectivelyEmptyEditorState(fromBuilder);
  if (pageHasContent) return fromPage;
  if (builderHasContent) return fromBuilder;
  return fromPage || fromBuilder;
}

/** Refuse to replace saved homepage content with an empty Craft.js canvas. */
export function editorStatePatchOrSkip(
  existing: string | null,
  incoming?: string,
  emptyFallback?: string
): string | undefined {
  if (incoming === undefined) return undefined;
  const normalized = normalizeEditorState(incoming);
  const next = normalized ?? emptyFallback;
  if (
    next &&
    isEffectivelyEmptyEditorState(next) &&
    existing &&
    !isEffectivelyEmptyEditorState(existing)
  ) {
    return undefined;
  }
  return next;
}
