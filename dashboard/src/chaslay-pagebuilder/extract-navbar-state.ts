const NAVBAR_NAMES = new Set([
  'NavbarClassic',
  'NavbarCentered',
  'NavbarMinimal',
  'NavbarModern',
]);

type CraftNode = {
  type?: { resolvedName?: string } | string;
  parent?: string;
  nodes?: string[];
  linkedNodes?: Record<string, string>;
  props?: Record<string, unknown>;
  [key: string]: unknown;
};

function parseEditorState(raw: string): Record<string, CraftNode> | null {
  try {
    let data: unknown = JSON.parse(raw);
    if (typeof data === 'string') data = JSON.parse(data);
    if (!data || typeof data !== 'object' || !('ROOT' in (data as object))) return null;
    return data as Record<string, CraftNode>;
  } catch {
    return null;
  }
}

function resolvedName(node: CraftNode | undefined): string {
  if (!node) return '';
  if (typeof node.type === 'string') return node.type;
  return node.type?.resolvedName || '';
}

function collectDescendants(nodes: Record<string, CraftNode>, id: string, keep: Set<string>) {
  if (keep.has(id) || !nodes[id]) return;
  keep.add(id);
  const node = nodes[id];
  for (const child of node.nodes || []) collectDescendants(nodes, child, keep);
  for (const child of Object.values(node.linkedNodes || {})) {
    if (typeof child === 'string') collectDescendants(nodes, child, keep);
  }
}

/** Build a Craft.js document that contains only homepage navbar node(s). */
export function extractNavbarEditorState(editorState: string): string | null {
  const nodes = parseEditorState(editorState);
  if (!nodes) return null;

  const navbarIds = Object.keys(nodes).filter((id) => id !== 'ROOT' && NAVBAR_NAMES.has(resolvedName(nodes[id])));
  if (!navbarIds.length) return null;

  const keep = new Set<string>();
  for (const id of navbarIds) collectDescendants(nodes, id, keep);

  const root = nodes.ROOT || {};
  const next: Record<string, CraftNode> = {
    ROOT: {
      ...root,
      props: { ...(root.props || {}), background: 'transparent', minHeight: 0 },
      nodes: navbarIds,
      linkedNodes: {},
    },
  };

  for (const id of keep) {
    next[id] = {
      ...nodes[id],
      parent: navbarIds.includes(id) ? 'ROOT' : nodes[id].parent,
    };
  }

  return JSON.stringify(next);
}
