"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Chaslay homepage heal — run: npx tsx backend/src/lib/chaslay-homepage-heal.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const chaslay_homepage_heal_1 = require("./chaslay-homepage-heal");
const chaslay_editor_state_1 = require("./chaslay-editor-state");
const state = (0, chaslay_homepage_heal_1.buildCustomHtmlEditorState)("<section><h1>Brazza</h1></section>");
strict_1.default.equal((0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(state), false);
const parsed = JSON.parse(state);
strict_1.default.equal(parsed.ROOT.nodes.length, 1);
strict_1.default.equal(parsed[parsed.ROOT.nodes[0]].type.resolvedName, "CustomHTML");
const fromLegacy = (0, chaslay_homepage_heal_1.editorStateFromLegacyCmsBlocks)({
    engine: "openpage",
    config: { name: "Home", blocks: [{ id: "b1", type: "hero", variant: "default", props: {} }] },
    html: "<div><p>Welcome to Brazza Pizzeria</p></div>",
}, "Home");
strict_1.default.ok(fromLegacy);
strict_1.default.equal((0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(fromLegacy), false);
const emptyLegacy = (0, chaslay_homepage_heal_1.editorStateFromLegacyCmsBlocks)({ engine: "openpage", config: { name: "", blocks: [] }, html: "" }, "Home");
strict_1.default.equal(emptyLegacy, null);
const chaslay_editor_state_2 = require("./chaslay-editor-state");
const pageContent = (0, chaslay_homepage_heal_1.buildCustomHtmlEditorState)("<p>Page row</p>");
const builderContent = (0, chaslay_homepage_heal_1.buildCustomHtmlEditorState)("<p>Builder row</p>");
strict_1.default.equal((0, chaslay_editor_state_2.pickPublishedEditorState)(pageContent, null), pageContent);
strict_1.default.equal((0, chaslay_editor_state_2.pickPublishedEditorState)(null, builderContent), builderContent);
const emptyCanvas = JSON.stringify({
    ROOT: {
        type: { resolvedName: "RootContainer" },
        isCanvas: true,
        props: {},
        displayName: "RootContainer",
        custom: {},
        hidden: false,
        nodes: [],
        linkedNodes: {},
    },
});
strict_1.default.equal((0, chaslay_editor_state_2.pickPublishedEditorState)(emptyCanvas, emptyCanvas, pageContent, null), pageContent);
strict_1.default.throws(() => (0, chaslay_editor_state_2.assertPublishableHomepage)(emptyCanvas, emptyCanvas, pageContent, null), (err) => err.name === "EditorStateWipeError");
console.log("chaslay-homepage-heal: all assertions passed");
//# sourceMappingURL=chaslay-homepage-heal.test.js.map