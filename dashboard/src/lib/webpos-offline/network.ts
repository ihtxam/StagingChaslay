import { isBrowserOnline } from './types';

/** Axios timeout for catalog boot — fail fast offline so IndexedDB can hydrate. */
export const WEBPOS_CATALOG_FETCH_TIMEOUT_MS = 8_000;

/** True when the failure looks like connectivity / transport, not a business 4xx. */
export function isNetworkError(err: unknown): boolean {
  if (!isBrowserOnline()) return true;
  const e = err as {
    code?: string;
    message?: string;
    response?: unknown;
    request?: unknown;
  } | null;
  if (!e) return false;
  if (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED') return true;
  const msg = String(e.message || '');
  if (/network error|failed to fetch|load failed|timeout/i.test(msg)) return true;
  // Axios: request left the browser but no HTTP response arrived
  if (e.request && !e.response) return true;
  return false;
}

/** HTTP statuses that should not be retried from the outbox. */
export function isFatalPushStatus(status: number | undefined): boolean {
  if (status == null) return false;
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

export function pushErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return String(e?.response?.data?.error || e?.message || 'Sync failed');
}
