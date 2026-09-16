import type { Data } from '@measured/puck';

function puckItemId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `puck-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeContentItems(items: unknown): Data['content'] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object' && typeof (item as { type?: unknown }).type === 'string')
    .map((item) => {
      const block = item as { id?: string; type: string; props?: Record<string, unknown> };
      return {
        ...block,
        id: String(block.id || puckItemId()),
        props: block.props && typeof block.props === 'object' ? block.props : {},
      };
    });
}

function normalizeZones(zones: unknown): Data['zones'] {
  if (!zones || typeof zones !== 'object' || Array.isArray(zones)) return {};
  const result: NonNullable<Data['zones']> = {};
  for (const [key, value] of Object.entries(zones as Record<string, unknown>)) {
    result[key] = normalizeContentItems(value);
  }
  return result;
}

/** Puck drag-and-drop requires every block (and zone item) to have a stable id. */
export function normalizePuckData(data: Data | null | undefined | Record<string, unknown>): Data {
  const raw: Partial<Data> =
    data && typeof data === 'object' ? (data as Partial<Data>) : { content: [], zones: {} };

  return {
    root: {
      props: {
        background: '#f5f5f4',
        ...(raw.root?.props && typeof raw.root.props === 'object' ? raw.root.props : {}),
      },
    },
    content: normalizeContentItems(raw.content),
    zones: normalizeZones(raw.zones),
  } as Data;
}
