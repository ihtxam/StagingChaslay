"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Chaslay editor state helpers — run: npx tsx backend/src/lib/chaslay-editor-state.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const chaslay_editor_state_1 = require("./chaslay-editor-state");
const EMPTY = JSON.stringify({
    ROOT: {
        type: { resolvedName: 'RootContainer' },
        isCanvas: true,
        props: { background: '#ffffff', minHeight: 600 },
        displayName: 'RootContainer',
        custom: {},
        hidden: false,
        nodes: [],
        linkedNodes: {},
    },
});
const WITH_BLOCK = JSON.stringify({
    ROOT: {
        type: { resolvedName: 'RootContainer' },
        isCanvas: true,
        props: {},
        displayName: 'RootContainer',
        custom: {},
        hidden: false,
        nodes: ['node-1'],
        linkedNodes: {},
    },
    'node-1': {
        type: { resolvedName: 'Text' },
        isCanvas: false,
        props: { text: 'Hello' },
        displayName: 'Text',
        custom: {},
        hidden: false,
        nodes: [],
        linkedNodes: {},
        parent: 'ROOT',
    },
});
strict_1.default.equal((0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(null), true);
strict_1.default.equal((0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(EMPTY), true);
strict_1.default.equal((0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(WITH_BLOCK), false);
strict_1.default.equal((0, chaslay_editor_state_1.normalizeEditorState)('{}'), null);
strict_1.default.equal((0, chaslay_editor_state_1.normalizeEditorState)(WITH_BLOCK), WITH_BLOCK);
strict_1.default.equal((0, chaslay_editor_state_1.pickPublishedEditorState)(null, WITH_BLOCK), WITH_BLOCK);
strict_1.default.equal((0, chaslay_editor_state_1.pickPublishedEditorState)(EMPTY, WITH_BLOCK), WITH_BLOCK);
strict_1.default.equal((0, chaslay_editor_state_1.pickPublishedEditorState)(WITH_BLOCK, EMPTY), WITH_BLOCK);
strict_1.default.equal((0, chaslay_editor_state_1.editorStatePatchOrSkip)(WITH_BLOCK, EMPTY), undefined);
strict_1.default.equal((0, chaslay_editor_state_1.editorStatePatchOrSkip)(null, EMPTY, EMPTY), EMPTY);
strict_1.default.equal((0, chaslay_editor_state_1.wouldWipeEditorState)(WITH_BLOCK, EMPTY, EMPTY), true);
strict_1.default.throws(() => (0, chaslay_editor_state_1.editorStatePatchOrThrow)(WITH_BLOCK, EMPTY, EMPTY), chaslay_editor_state_1.EditorStateWipeError);
const writePatch = (0, chaslay_editor_state_1.buildEditorStateWritePatch)(null, null, WITH_BLOCK, EMPTY);
strict_1.default.equal(writePatch.editorState, WITH_BLOCK);
strict_1.default.equal(writePatch.lastGoodEditorState, WITH_BLOCK);
strict_1.default.equal((0, chaslay_editor_state_1.pickPublishedEditorState)(EMPTY, null, WITH_BLOCK, null), WITH_BLOCK);
strict_1.default.throws(() => (0, chaslay_editor_state_1.assertPublishableHomepage)(EMPTY, EMPTY, WITH_BLOCK, null), chaslay_editor_state_1.EditorStateWipeError);
strict_1.default.doesNotThrow(() => (0, chaslay_editor_state_1.assertPublishableHomepage)(WITH_BLOCK, EMPTY, null, null));
console.log('chaslay-editor-state: all assertions passed');
//# sourceMappingURL=chaslay-editor-state.test.js.map