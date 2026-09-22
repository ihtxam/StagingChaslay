/**
 * Chaslay homepage heal — run: npx tsx backend/src/lib/chaslay-homepage-heal.test.ts
 */
import assert from "node:assert/strict";
import {
  buildCustomHtmlEditorState,
  editorStateFromLegacyCmsBlocks,
} from "./chaslay-homepage-heal";
import { isEffectivelyEmptyEditorState } from "./chaslay-editor-state";

const state = buildCustomHtmlEditorState("<section><h1>Brazza</h1></section>");
assert.equal(isEffectivelyEmptyEditorState(state), false);
const parsed = JSON.parse(state) as { ROOT: { nodes: string[] } };
assert.equal(parsed.ROOT.nodes.length, 1);
assert.equal(parsed[parsed.ROOT.nodes[0]].type.resolvedName, "CustomHTML");

const fromLegacy = editorStateFromLegacyCmsBlocks(
  {
    engine: "openpage",
    config: { name: "Home", blocks: [{ id: "b1", type: "hero", variant: "default", props: {} }] },
    html: "<div><p>Welcome to Brazza Pizzeria</p></div>",
  },
  "Home"
);
assert.ok(fromLegacy);
assert.equal(isEffectivelyEmptyEditorState(fromLegacy), false);

const emptyLegacy = editorStateFromLegacyCmsBlocks(
  { engine: "openpage", config: { name: "", blocks: [] }, html: "" },
  "Home"
);
assert.equal(emptyLegacy, null);

console.log("chaslay-homepage-heal: all assertions passed");
