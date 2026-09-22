/**
 * Chaslay editor state helpers — run: npx tsx backend/src/lib/chaslay-editor-state.test.ts
 */
import assert from 'node:assert/strict';
import {
  isEffectivelyEmptyEditorState,
  normalizeEditorState,
  pickPublishedEditorState,
  editorStatePatchOrSkip,
} from './chaslay-editor-state';

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

assert.equal(isEffectivelyEmptyEditorState(null), true);
assert.equal(isEffectivelyEmptyEditorState(EMPTY), true);
assert.equal(isEffectivelyEmptyEditorState(WITH_BLOCK), false);
assert.equal(normalizeEditorState('{}'), null);
assert.equal(normalizeEditorState(WITH_BLOCK), WITH_BLOCK);

assert.equal(pickPublishedEditorState(null, WITH_BLOCK), WITH_BLOCK);
assert.equal(pickPublishedEditorState(EMPTY, WITH_BLOCK), WITH_BLOCK);
assert.equal(pickPublishedEditorState(WITH_BLOCK, EMPTY), WITH_BLOCK);

assert.equal(editorStatePatchOrSkip(WITH_BLOCK, EMPTY), undefined);
assert.equal(editorStatePatchOrSkip(null, EMPTY, EMPTY), EMPTY);

console.log('chaslay-editor-state: all assertions passed');
