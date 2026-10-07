/** Craft.js canvas with no blocks — valid JSON but not publishable homepage content. */
export declare function isEffectivelyEmptyEditorState(state?: string | null): boolean;
export declare function normalizeEditorState(state?: string | null): string | null;
export declare class EditorStateWipeError extends Error {
    constructor(message?: string);
}
/** Refuse to replace saved homepage content with an empty Craft.js canvas. */
export declare function editorStatePatchOrSkip(existing: string | null, incoming?: string, emptyFallback?: string): string | undefined;
/** True when incoming would replace non-empty saved content with an empty canvas. */
export declare function wouldWipeEditorState(existing: string | null, incoming?: string | null, emptyFallback?: string): boolean;
/** Like patchOrSkip but throws when an empty save would wipe existing content. */
export declare function editorStatePatchOrThrow(existing: string | null, incoming?: string, emptyFallback?: string): string | undefined;
/** Prefer page row when it has blocks; otherwise fall back to builder snapshot and backups. */
export declare function pickPublishedEditorState(pageState: string | null, builderState: string | null, pageLastGood?: string | null, builderLastGood?: string | null): string | null;
export type EditorStateWritePatch = {
    editorState?: string;
    lastGoodEditorState?: string;
};
/** Central guard for all backend editor_state writes. */
export declare function buildEditorStateWritePatch(existing: string | null, lastGood: string | null, incoming?: string, emptyFallback?: string): EditorStateWritePatch;
/** Block publishing/activating when the resolved homepage would be empty but backups exist. */
export declare function assertPublishableHomepage(pageState: string | null, builderState: string | null, pageLastGood?: string | null, builderLastGood?: string | null): void;
//# sourceMappingURL=chaslay-editor-state.d.ts.map