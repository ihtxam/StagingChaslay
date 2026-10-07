"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditorStateWipeError = void 0;
exports.isEffectivelyEmptyEditorState = isEffectivelyEmptyEditorState;
exports.normalizeEditorState = normalizeEditorState;
exports.editorStatePatchOrSkip = editorStatePatchOrSkip;
exports.wouldWipeEditorState = wouldWipeEditorState;
exports.editorStatePatchOrThrow = editorStatePatchOrThrow;
exports.pickPublishedEditorState = pickPublishedEditorState;
exports.buildEditorStateWritePatch = buildEditorStateWritePatch;
exports.assertPublishableHomepage = assertPublishableHomepage;
/** Craft.js canvas with no blocks — valid JSON but not publishable homepage content. */
function isEffectivelyEmptyEditorState(state) {
    if (state == null)
        return true;
    const trimmed = state.trim();
    if (!trimmed || trimmed === "{}")
        return true;
    try {
        const parsed = JSON.parse(trimmed);
        const nodes = parsed?.ROOT?.nodes;
        return !Array.isArray(nodes) || nodes.length === 0;
    }
    catch {
        return true;
    }
}
function normalizeEditorState(state) {
    if (state == null)
        return null;
    const trimmed = state.trim();
    if (!trimmed || trimmed === "{}")
        return null;
    try {
        JSON.parse(trimmed);
        return trimmed;
    }
    catch {
        return null;
    }
}
class EditorStateWipeError extends Error {
    constructor(message = "Cannot save empty homepage content when a previous version exists") {
        super(message);
        this.name = "EditorStateWipeError";
    }
}
exports.EditorStateWipeError = EditorStateWipeError;
/** Refuse to replace saved homepage content with an empty Craft.js canvas. */
function editorStatePatchOrSkip(existing, incoming, emptyFallback) {
    if (incoming === undefined)
        return undefined;
    const normalized = normalizeEditorState(incoming);
    const next = normalized ?? emptyFallback;
    if (wouldWipeEditorState(existing, next))
        return undefined;
    return next;
}
/** True when incoming would replace non-empty saved content with an empty canvas. */
function wouldWipeEditorState(existing, incoming, emptyFallback) {
    const normalized = incoming === undefined ? undefined : normalizeEditorState(incoming);
    const next = incoming === undefined ? undefined : normalized ?? emptyFallback;
    return Boolean(next &&
        isEffectivelyEmptyEditorState(next) &&
        existing &&
        !isEffectivelyEmptyEditorState(existing));
}
/** Like patchOrSkip but throws when an empty save would wipe existing content. */
function editorStatePatchOrThrow(existing, incoming, emptyFallback) {
    if (wouldWipeEditorState(existing, incoming, emptyFallback)) {
        throw new EditorStateWipeError();
    }
    return editorStatePatchOrSkip(existing, incoming, emptyFallback);
}
/** Prefer page row when it has blocks; otherwise fall back to builder snapshot and backups. */
function pickPublishedEditorState(pageState, builderState, pageLastGood, builderLastGood) {
    const fromPage = normalizeEditorState(pageState);
    const fromBuilder = normalizeEditorState(builderState);
    const pageHasContent = fromPage && !isEffectivelyEmptyEditorState(fromPage);
    const builderHasContent = fromBuilder && !isEffectivelyEmptyEditorState(fromBuilder);
    if (pageHasContent)
        return fromPage;
    if (builderHasContent)
        return fromBuilder;
    const fromPageBackup = normalizeEditorState(pageLastGood);
    const fromBuilderBackup = normalizeEditorState(builderLastGood);
    if (fromPageBackup && !isEffectivelyEmptyEditorState(fromPageBackup))
        return fromPageBackup;
    if (fromBuilderBackup && !isEffectivelyEmptyEditorState(fromBuilderBackup))
        return fromBuilderBackup;
    return fromPage || fromBuilder;
}
/** Central guard for all backend editor_state writes. */
function buildEditorStateWritePatch(existing, lastGood, incoming, emptyFallback) {
    if (incoming === undefined)
        return {};
    const next = editorStatePatchOrThrow(existing, incoming, emptyFallback);
    if (next === undefined)
        return {};
    const patch = { editorState: next };
    if (!isEffectivelyEmptyEditorState(next)) {
        patch.lastGoodEditorState = next;
    }
    else if (lastGood && !isEffectivelyEmptyEditorState(lastGood)) {
        patch.lastGoodEditorState = lastGood;
    }
    return patch;
}
/** Block publishing/activating when the resolved homepage would be empty but backups exist. */
function assertPublishableHomepage(pageState, builderState, pageLastGood, builderLastGood) {
    const resolved = pickPublishedEditorState(pageState, builderState);
    if (resolved && !isEffectivelyEmptyEditorState(resolved))
        return;
    const backup = pickPublishedEditorState(null, null, pageLastGood, builderLastGood);
    if (backup && !isEffectivelyEmptyEditorState(backup)) {
        throw new EditorStateWipeError("Cannot publish an empty homepage while a previous version exists. Open the editor and restore content first.");
    }
}
//# sourceMappingURL=chaslay-editor-state.js.map