import { asStringArray } from './safe-iterables';

export type OdsBoardStatus = {
  licensed: boolean;
  preparing: string[];
  ready: string[];
};

export function parseOdsStatusPayload(data: unknown): OdsBoardStatus {
  if (!data || typeof data !== 'object') {
    return { licensed: false, preparing: [], ready: [] };
  }
  const raw = data as Record<string, unknown>;
  return {
    licensed: raw.licensed !== false,
    preparing: asStringArray(raw.preparing),
    ready: asStringArray(raw.ready),
  };
}
