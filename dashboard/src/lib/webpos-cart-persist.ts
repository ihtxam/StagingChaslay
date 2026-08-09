import type { OpenCartDraft } from '@/components/webpos/types';

const STORAGE_KEY = 'manupos_webpos_open_carts_v1';

export type PersistedWebPosCustomer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  defaultAddress?: string | null;
  defaultZip?: string | null;
  defaultCity?: string | null;
};

export type PersistedWebPosCarts = {
  v: 1;
  drafts: Record<string, OpenCartDraft>;
  /** Current on-screen cart (may match a draft key). */
  active: OpenCartDraft | null;
  mobileCartOpen: boolean;
  customer: PersistedWebPosCustomer | null;
  savedAt: number;
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

export function loadPersistedWebPosCarts(): PersistedWebPosCarts | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWebPosCarts;
    if (!parsed || parsed.v !== 1 || typeof parsed !== 'object') return null;
    if (!parsed.drafts || typeof parsed.drafts !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedWebPosCarts(data: Omit<PersistedWebPosCarts, 'v' | 'savedAt'>) {
  if (!canUseStorage()) return;
  try {
    const hasWork =
      !!data.active?.cart?.length ||
      !!data.active?.orderSent ||
      Object.values(data.drafts || {}).some((d) => d?.cart?.length || d?.orderSent);
    if (!hasWork) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload: PersistedWebPosCarts = {
      v: 1,
      drafts: data.drafts,
      active: data.active,
      mobileCartOpen: !!data.mobileCartOpen,
      customer: data.customer || null,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedWebPosCarts() {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function draftsMapToRecord(map: Map<string, OpenCartDraft>): Record<string, OpenCartDraft> {
  const out: Record<string, OpenCartDraft> = {};
  for (const [k, v] of map.entries()) out[k] = v;
  return out;
}

export function recordToDraftsMap(record: Record<string, OpenCartDraft> | null | undefined) {
  const map = new Map<string, OpenCartDraft>();
  if (!record) return map;
  for (const [k, v] of Object.entries(record)) {
    if (v && Array.isArray(v.cart)) map.set(k, v);
  }
  return map;
}
