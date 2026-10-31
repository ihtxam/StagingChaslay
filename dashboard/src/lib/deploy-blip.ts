import toast from 'react-hot-toast';
import { isLocale, PANEL_LANG_KEY, translate, type Locale } from './i18n';

export const DEPLOY_TOAST_ID = 'system-update';
export const DEPLOY_TOAST_WINDOW_MS = 12_000;

const DEPLOY_STATUSES = new Set([502, 503, 504]);
const BUSINESS_STATUSES = new Set([400, 401, 403, 409, 422]);

let deployWindowUntil = 0;
let toastGuardInstalled = false;

type AxiosLike = {
  response?: {
    status?: number;
    data?: unknown;
    headers?: Record<string, unknown>;
  };
  code?: string;
  message?: string;
};

function panelLocale(): Locale {
  try {
    const stored = localStorage.getItem(PANEL_LANG_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'en';
}

export function systemUpdateMessage(locale?: Locale): string {
  return translate(locale ?? panelLocale(), 'systemUpdateWait');
}

export function apiTryAgainMessage(locale?: Locale): string {
  return translate(locale ?? panelLocale(), 'apiErrorTryAgain');
}

/** Axios / proxy noise — never show these strings to staff in the panel. */
export function isAxiosStatusMessage(message: string): boolean {
  return /request failed with status code \d{3}/i.test(message.trim());
}

function looksLikeTechnicalHttpMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    isAxiosStatusMessage(text) ||
    /^5\d{2}(\s|$)/.test(text) ||
    /bad gateway|service unavailable|gateway timeout/i.test(text)
  );
}

/** Map API failures to short, staff-friendly copy (deploy, 5xx, network). */
export function formatUserFacingApiError(error: unknown, fallback: string, locale?: Locale): string {
  const loc = locale ?? panelLocale();
  if (isDeployBlip(error) && deployBlipMatchesClientRing(error)) {
    return systemUpdateMessage(loc);
  }
  const err = error as AxiosLike & { response?: { data?: { error?: string } } };
  const status = err.response?.status;
  const apiErr = err.response?.data?.error;
  if (typeof apiErr === 'string' && apiErr.trim() && !looksLikeTechnicalHttpMessage(apiErr)) {
    return apiErr.trim();
  }
  const msg = String(err.message || '').trim();
  if (msg && !looksLikeTechnicalHttpMessage(msg) && !isAxiosStatusMessage(msg)) {
    return msg;
  }
  if (status != null && status >= 500) {
    return apiTryAgainMessage(loc);
  }
  if (!err.response) {
    const code = String(err.code || '');
    if (
      code === 'ERR_NETWORK' ||
      code === 'ERR_BAD_RESPONSE' ||
      code === 'ECONNRESET' ||
      /failed to fetch|network error|load failed/i.test(msg)
    ) {
      return apiTryAgainMessage(loc);
    }
  }
  return fallback;
}

export function isHtmlErrorBody(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  const text = data.trim();
  if (!text) return false;
  return (
    /^<!doctype\s+html/i.test(text) ||
    /^<html[\s>]/i.test(text) ||
    /<\/html>/i.test(text) ||
    /<title>\s*(502|503|504|bad gateway|service unavailable)/i.test(text)
  );
}

function isEmptyBody(data: unknown): boolean {
  if (data == null) return true;
  if (typeof data === 'string') return data.trim() === '';
  return false;
}

function contentTypeLooksHtml(headers: Record<string, unknown> | undefined): boolean {
  if (!headers) return false;
  const raw = headers['content-type'] ?? headers['Content-Type'];
  return typeof raw === 'string' && /text\/html/i.test(raw);
}

/** 502/503/504, network drop, HTML/Caddy body — not 401/403/422 business errors. */
const CLIENT_DEPLOY_RING =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEPLOY_RING
    ? String(import.meta.env.VITE_DEPLOY_RING).trim()
    : '';

function responseDeployRing(error: unknown): string | null {
  const err = error as { response?: { headers?: Record<string, unknown> } };
  const headers = err.response?.headers;
  if (!headers) return null;
  const raw = headers['x-reborn-deploy-ring'] ?? headers['X-Reborn-Deploy-Ring'];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/** Ignore deploy blips from another ring (e.g. misconfigured API URL). */
export function deployBlipMatchesClientRing(error: unknown): boolean {
  const serverRing = responseDeployRing(error);
  if (!serverRing) return true;
  const clientRing = CLIENT_DEPLOY_RING || inferDeployRingFromHostname();
  return serverRing === clientRing;
}

function inferDeployRingFromHostname(): string {
  if (typeof window === 'undefined') return 'production';
  const host = window.location.hostname.toLowerCase();
  if (host.includes('chaslay.com')) return 'staging';
  return 'production';
}

export function isDeployBlip(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as AxiosLike;
  const status = err.response?.status;

  if (status != null && BUSINESS_STATUSES.has(status)) return false;
  if (status != null && DEPLOY_STATUSES.has(status)) return true;

  const data = err.response?.data;
  if (isHtmlErrorBody(data) || contentTypeLooksHtml(err.response?.headers)) return true;

  if (!err.response) {
    const code = String(err.code || '');
    // Slow catalog/settings timeouts are not deploys — avoid "wait for system update" false positives.
    if (code === 'ECONNABORTED') return false;
    if (
      code === 'ERR_NETWORK' ||
      code === 'ERR_BAD_RESPONSE' ||
      code === 'ECONNRESET'
    ) {
      return true;
    }
    const msg = String(err.message || '');
    if (/network error|failed to fetch|load failed|networkerror/i.test(msg)) return true;
  }

  if (status != null && status >= 500 && isEmptyBody(data) && status !== 500) return true;

  return false;
}

export function isDeployToastWindowOpen(now = Date.now()): boolean {
  return now < deployWindowUntil;
}

export function resetDeployBlipStateForTests(): void {
  deployWindowUntil = 0;
}

function openDeployToastWindow(now = Date.now()): void {
  deployWindowUntil = now + DEPLOY_TOAST_WINDOW_MS;
}

function showSystemUpdateToast(opts?: Parameters<typeof toast.loading>[1]): string {
  const message = systemUpdateMessage();
  return toast.loading(message, { id: DEPLOY_TOAST_ID, duration: 8000, ...opts });
}

/** One toast for a burst of deploy 502s — same id, same window. */
export function notifyDeployBlip(error?: unknown): string {
  if (error != null && !deployBlipMatchesClientRing(error)) {
    return systemUpdateMessage();
  }
  openDeployToastWindow();
  showSystemUpdateToast();
  return systemUpdateMessage();
}

export function toastLoadError(error: unknown, fallback: string): void {
  if (isDeployBlip(error) && deployBlipMatchesClientRing(error)) {
    notifyDeployBlip(error);
    return;
  }
  toast.error(formatUserFacingApiError(error, fallback));
}

function looksLikeLoadFailedToast(message: unknown): boolean {
  const text = typeof message === 'string' ? message : '';
  return (
    isAxiosStatusMessage(text) ||
    looksLikeTechnicalHttpMessage(text) ||
    /failed to load|could not load|cannot load|can't load|couldn't load|échec du chargement|impossible de charger|konnten nicht geladen|konnte nicht geladen|nicht geladen werden/i.test(
      text
    )
  );
}

/** Collapse per-resource "Cannot load X" toasts while a deploy blip is active. */
export function installDeployToastGuard(): void {
  if (toastGuardInstalled) return;
  toastGuardInstalled = true;
  const original = toast.error.bind(toast);
  toast.error = ((message, opts) => {
    if (typeof message === 'string' && looksLikeLoadFailedToast(message)) {
      if (isDeployToastWindowOpen()) {
        return showSystemUpdateToast({ ...opts, id: DEPLOY_TOAST_ID });
      }
      return original(apiTryAgainMessage(), opts);
    }
    return original(message, opts);
  }) as typeof toast.error;
}

export function shouldSkipDeployToastForRequest(error: unknown): boolean {
  const err = error as { config?: { url?: string } };
  const url = String(err.config?.url || '');
  if (/\/auth\//.test(url)) return true;
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname || '';
  return (
    path.startsWith('/login') ||
    path.startsWith('/signin') ||
    path === '/superadmin/login' ||
    path === '/reseller/login' ||
    path === '/merchant/login'
  );
}
