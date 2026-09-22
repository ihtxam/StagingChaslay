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

export class EditorStateWipeError extends Error {
  constructor(message = "Cannot save empty homepage content when a previous version exists") {
    super(message);
    this.name = "EditorStateWipeError";
  }
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
  if (wouldWipeEditorState(existing, next)) return undefined;
  return next;
}

/** True when incoming would replace non-empty saved content with an empty canvas. */
export function wouldWipeEditorState(
  existing: string | null,
  incoming?: string | null,
  emptyFallback?: string
): boolean {
  const normalized = incoming === undefined ? undefined : normalizeEditorState(incoming);
  const next = incoming === undefined ? undefined : normalized ?? emptyFallback;
  return Boolean(
    next &&
      isEffectivelyEmptyEditorState(next) &&
      existing &&
      !isEffectivelyEmptyEditorState(existing)
  );
}

/** Like patchOrSkip but throws when an empty save would wipe existing content. */
export function editorStatePatchOrThrow(
  existing: string | null,
  incoming?: string,
  emptyFallback?: string
): string | undefined {
  if (wouldWipeEditorState(existing, incoming, emptyFallback)) {
    throw new EditorStateWipeError();
  }
  return editorStatePatchOrSkip(existing, incoming, emptyFallback);
}

/** Prefer page row when it has blocks; otherwise fall back to builder snapshot and backups. */
export function pickPublishedEditorState(
  pageState: string | null,
  builderState: string | null,
  pageLastGood?: string | null,
  builderLastGood?: string | null
): string | null {
  const fromPage = normalizeEditorState(pageState);
  const fromBuilder = normalizeEditorState(builderState);
  const pageHasContent = fromPage && !isEffectivelyEmptyEditorState(fromPage);
  const builderHasContent = fromBuilder && !isEffectivelyEmptyEditorState(fromBuilder);
  if (pageHasContent) return fromPage;
  if (builderHasContent) return fromBuilder;
  const fromPageBackup = normalizeEditorState(pageLastGood);
  const fromBuilderBackup = normalizeEditorState(builderLastGood);
  if (fromPageBackup && !isEffectivelyEmptyEditorState(fromPageBackup)) return fromPageBackup;
  if (fromBuilderBackup && !isEffectivelyEmptyEditorState(fromBuilderBackup)) return fromBuilderBackup;
  return fromPage || fromBuilder;
}

export type EditorStateWritePatch = {
  editorState?: string;
  lastGoodEditorState?: string;
};

/** Central guard for all backend editor_state writes. */
export function buildEditorStateWritePatch(
  existing: string | null,
  lastGood: string | null,
  incoming?: string,
  emptyFallback?: string
): EditorStateWritePatch {
  if (incoming === undefined) return {};
  const next = editorStatePatchOrThrow(existing, incoming, emptyFallback);
  if (next === undefined) return {};
  const patch: EditorStateWritePatch = { editorState: next };
  if (!isEffectivelyEmptyEditorState(next)) {
    patch.lastGoodEditorState = next;
  } else if (lastGood && !isEffectivelyEmptyEditorState(lastGood)) {
    patch.lastGoodEditorState = lastGood;
  }
  return patch;
}

/** Block publishing/activating when the resolved homepage would be empty but backups exist. */
export function assertPublishableHomepage(
  pageState: string | null,
  builderState: string | null,
  pageLastGood?: string | null,
  builderLastGood?: string | null
): void {
  const resolved = pickPublishedEditorState(pageState, builderState);
  if (resolved && !isEffectivelyEmptyEditorState(resolved)) return;
  const backup = pickPublishedEditorState(null, null, pageLastGood, builderLastGood);
  if (backup && !isEffectivelyEmptyEditorState(backup)) {
    throw new EditorStateWipeError(
      "Cannot publish an empty homepage while a previous version exists. Open the editor and restore content first."
    );
  }
}
