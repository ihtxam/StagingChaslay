/**
 * Bridge Reborn — tap-to-pay on Android tablets running WebPOS in Chrome.
 *
 * Companion APK (localhost :9101). Printing and NFC payments share one
 * always-on foreground service; WebPOS stays a normal PWA in Chrome.
 */

import { resolveApiOriginForBridge } from '@/lib/api';
import { markBridgeRebornInstalled } from '@/lib/pwa';
import { PRINT_AGENT_URL } from '@/lib/print-agent';

export type DeviceBridgeHealth = {
  ok: boolean;
  version?: string;
  platform?: string;
  /** Device exposes NFC hardware */
  nfcAvailable?: boolean;
  /** Adyen SDK bundled in Bridge APK (false = print-only stub build) */
  hasAdyenSdk?: boolean;
  /** Adyen SoftPOS SDK initialized and ready for sales */
  tapToPayReady?: boolean;
  /** Device completed one-time Tap to Pay registration (warmUp + installationId) */
  tapToPayRegistered?: boolean;
  /** Human-readable reason when tapToPayReady is false */
  tapToPayMessage?: string;
};

export type TapToPaySaleRequest = {
  amountMinor: number;
  currency: string;
  /** Dashboard API origin, e.g. https://app.rebornsense.com */
  apiBaseUrl: string;
  /** Merchant dashboard JWT (same token WebPOS uses for API calls) */
  authToken: string;
  reference?: string;
};

export type TapToPaySaleResult = {
  ok: boolean;
  status?: 'approved' | 'declined' | 'cancelled' | 'error';
  reference?: string;
  message?: string;
};

function bridgeUrl(path: string): string {
  return `${PRINT_AGENT_URL}${path}`;
}

/** Push WebPOS origin so Bridge setup wizard can reopen the correct site (staging vs prod). */
export async function syncBridgeWebPosOrigin(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch(bridgeUrl('/config'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webpos_origin: window.location.origin }),
    });
  } catch {
    /* bridge offline */
  }
}

/** Extend /health with tap-to-pay capability flags from Device Bridge ≥ 0.3.0 */
export async function getDeviceBridgeHealth(): Promise<DeviceBridgeHealth> {
  try {
    const res = await fetch(bridgeUrl('/health'), { method: 'GET' });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: data.ok === true,
      version: data.version != null ? String(data.version) : undefined,
      platform: data.platform != null ? String(data.platform) : undefined,
      nfcAvailable: data.nfcAvailable === true,
      hasAdyenSdk: data.hasAdyenSdk === true,
      tapToPayReady: data.tapToPayReady === true,
      tapToPayRegistered: data.tapToPayRegistered === true,
      tapToPayMessage:
        data.tapToPayMessage != null ? String(data.tapToPayMessage) : undefined,
    };
  } catch {
    return { ok: false };
  }
}

/** Probe Bridge Reborn /health with backoff (tablet cold start). */
export async function probeDeviceBridgeHealth(attempts = 5): Promise<DeviceBridgeHealth> {
  let last: DeviceBridgeHealth = { ok: false };
  const tries = Math.max(1, attempts);
  for (let i = 0; i < tries; i++) {
    last = await getDeviceBridgeHealth();
    if (last.ok) {
      markBridgeRebornInstalled();
      return last;
    }
    if (i + 1 < tries) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return last;
}

export async function isDeviceBridgeTapToPayReady(): Promise<boolean> {
  const health = await probeDeviceBridgeHealth(3);
  return health.ok && health.tapToPayReady === true;
}

/**
 * Run an NFC tap-to-pay sale via the Device Bridge.
 * The bridge launches Adyen's native tap UI on the tablet; this call blocks until done.
 */
export async function runDeviceBridgeTapToPay(
  request: TapToPaySaleRequest,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<TapToPaySaleResult> {
  const timeoutMs = options?.timeoutMs ?? 170_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  options?.signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(bridgeUrl('/tap-to-pay'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_minor: request.amountMinor,
        currency: request.currency,
        api_base_url: request.apiBaseUrl.replace(/\/$/, ''),
        auth_token: request.authToken,
        reference: request.reference,
      }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: 'error',
        message: String(data.error || data.message || `Bridge Reborn HTTP ${res.status}`),
      };
    }
    const status = String(data.status || (data.ok === true ? 'approved' : 'error'));
    return {
      ok: data.ok === true || status === 'approved',
      status: status as TapToPaySaleResult['status'],
      reference: data.reference != null ? String(data.reference) : undefined,
      message: data.message != null ? String(data.message) : undefined,
    };
  } catch (e: unknown) {
    const aborted =
      (e as { name?: string })?.name === 'AbortError' ||
      options?.signal?.aborted ||
      controller.signal.aborted;
    return {
      ok: false,
      status: aborted ? 'cancelled' : 'error',
      message: aborted ? 'Payment cancelled.' : 'Could not reach Bridge Reborn.',
    };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener('abort', onAbort);
  }
}

export type TapToPayRegisterResult = {
  ok: boolean;
  installationId?: string;
  message?: string;
};

/** Session defaults for Bridge tap-to-pay (api origin + merchant JWT). */
export function resolveBridgeTapToPayAuth(): { apiBaseUrl: string; authToken: string } | null {
  if (typeof window === 'undefined') return null;
  const authToken = String(localStorage.getItem('token') || '').trim();
  if (!authToken) return null;
  const apiBaseUrl = resolveApiOriginForBridge();
  if (!apiBaseUrl) return null;
  return { apiBaseUrl, authToken };
}

/** One-time Tap to Pay activation (Adyen warmUp + device registration). */
export async function registerDeviceBridgeTapToPay(
  request?: { apiBaseUrl?: string; authToken?: string },
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<TapToPayRegisterResult> {
  const defaults = resolveBridgeTapToPayAuth();
  const apiBaseUrl = (request?.apiBaseUrl || defaults?.apiBaseUrl || '').trim();
  const authToken = (request?.authToken || defaults?.authToken || '').trim();
  if (!apiBaseUrl || !authToken) {
    return {
      ok: false,
      message: 'Sign in to WebPOS on this tablet first, then try again.',
    };
  }
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  options?.signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(bridgeUrl('/tap-to-pay/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_base_url: apiBaseUrl.replace(/\/$/, ''),
        auth_token: authToken,
      }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        message: String(data.error || data.message || `Bridge Reborn HTTP ${res.status}`),
      };
    }
    return {
      ok: data.ok === true,
      installationId:
        data.installation_id != null ? String(data.installation_id) : undefined,
      message: data.message != null ? String(data.message) : undefined,
    };
  } catch (e: unknown) {
    const aborted =
      (e as { name?: string })?.name === 'AbortError' ||
      options?.signal?.aborted ||
      controller.signal.aborted;
    return {
      ok: false,
      message: aborted ? 'Setup cancelled.' : 'Could not reach Bridge Reborn.',
    };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener('abort', onAbort);
  }
}
