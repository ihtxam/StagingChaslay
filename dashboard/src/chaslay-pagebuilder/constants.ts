/** Minimal valid Craft.js state with an empty RootContainer canvas. */
export const DEFAULT_EMPTY_CANVAS_STATE = JSON.stringify({
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
