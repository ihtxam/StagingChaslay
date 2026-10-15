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

/** One toast for a burst of deploy 502s — same id, same window. */
export function notifyDeployBlip(): string {
  openDeployToastWindow();
  const message = systemUpdateMessage();
  toast.error(message, { id: DEPLOY_TOAST_ID, duration: 8000 });
  return message;
}

export function toastLoadError(error: unknown, fallback: string): void {
  if (isDeployBlip(error)) {
    notifyDeployBlip();
    return;
  }
  const err = error as { response?: { data?: { error?: string } } };
  const apiError = err.response?.data?.error;
  toast.error(typeof apiError === 'string' && apiError.trim() ? apiError : fallback);
}

function looksLikeLoadFailedToast(message: unknown): boolean {
  const text = typeof message === 'string' ? message : '';
  return /failed to load|could not load|cannot load|can't load|couldn't load|échec du chargement|impossible de charger|konnten nicht geladen|konnte nicht geladen|nicht geladen werden/i.test(
    text
  );
}

/** Collapse per-resource "Cannot load X" toasts while a deploy blip is active. */
export function installDeployToastGuard(): void {
  if (toastGuardInstalled) return;
  toastGuardInstalled = true;
  const original = toast.error.bind(toast);
  toast.error = ((message, opts) => {
    if (isDeployToastWindowOpen() && looksLikeLoadFailedToast(message)) {
      return original(systemUpdateMessage(), { ...opts, id: DEPLOY_TOAST_ID });
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
