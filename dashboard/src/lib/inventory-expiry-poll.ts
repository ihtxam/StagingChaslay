/**
 * Merchant expiry-alert poll. Same gate as KDS/ODS: skip when the inventory
 * addon is off; treat 403 / INVENTORY_ADDON_REQUIRED as unlicensed.
 */

import { isAddonForbiddenStatus, shouldPollLicensedAddon } from './addon-poll';

export type ExpiringSoonPayload = {
  leadDays: number;
  lots: unknown[];
};

export const EMPTY_EXPIRING_SOON: ExpiringSoonPayload = { leadDays: 30, lots: [] };

export type ExpiringSoonGet = (
  url: string
) => Promise<{
  status?: number;
  data?: { leadDays?: number; lots?: unknown[]; code?: string };
}>;

export type ExpiringSoonLoadResult = {
  payload: ExpiringSoonPayload;
  unlicensed: boolean;
  /** Real 401 / 5xx — caller should surface, not treat as addon-off. */
  error?: unknown;
};

export function isInventoryAddonRequired(error: unknown): boolean {
  if (isAddonForbiddenStatus(error)) return true;
  const err = error as {
    response?: { data?: { code?: string } };
    data?: { code?: string };
  };
  const code = String(err?.response?.data?.code || err?.data?.code || '');
  return code === 'INVENTORY_ADDON_REQUIRED';
}

function payloadFromData(data: { leadDays?: number; lots?: unknown[] } | undefined): ExpiringSoonPayload {
  return {
    leadDays: Number(data?.leadDays) || 30,
    lots: Array.isArray(data?.lots) ? data.lots : [],
  };
}

/**
 * Fetch expiring lots when the addon is licensed.
 * Never throws (avoids unhandled rejections from the 2-minute poll).
 */
export async function loadExpiringSoonIfLicensed(opts: {
  licensed: boolean | null | undefined;
  stopped: boolean;
  get: ExpiringSoonGet;
}): Promise<ExpiringSoonLoadResult> {
  if (!shouldPollLicensedAddon(opts.licensed, opts.stopped)) {
    return { payload: EMPTY_EXPIRING_SOON, unlicensed: true };
  }

  try {
    const res = await opts.get('/merchant/inventory/expiring-soon');
    const status = res?.status ?? 200;
    const code = String(res?.data?.code || '');

    if (status === 403 || code === 'INVENTORY_ADDON_REQUIRED') {
      return { payload: EMPTY_EXPIRING_SOON, unlicensed: true };
    }
    if (status === 401 || status >= 500) {
      return {
        payload: EMPTY_EXPIRING_SOON,
        unlicensed: false,
        error: { status, data: res?.data },
      };
    }
    if (status !== 200) {
      return { payload: EMPTY_EXPIRING_SOON, unlicensed: false };
    }
    return { payload: payloadFromData(res?.data), unlicensed: false };
  } catch (error) {
    if (isInventoryAddonRequired(error)) {
      return { payload: EMPTY_EXPIRING_SOON, unlicensed: true };
    }
    return { payload: EMPTY_EXPIRING_SOON, unlicensed: false, error };
  }
}
