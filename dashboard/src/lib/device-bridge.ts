/**
 * Reborn Device Bridge — tap-to-pay on Android tablets running WebPOS in Chrome.
 *
 * Same companion APK as Print Bridge (localhost :9101). Printing and NFC payments
 * share one always-on foreground service; WebPOS stays a normal PWA.
 */

import { PRINT_AGENT_URL } from '@/lib/print-agent';

export type DeviceBridgeHealth = {
  ok: boolean;
  version?: string;
  platform?: string;
  /** Device exposes NFC hardware */
  nfcAvailable?: boolean;
  /** Adyen SoftPOS SDK initialized and ready for sales */
  tapToPayReady?: boolean;
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
      tapToPayReady: data.tapToPayReady === true,
      tapToPayMessage:
        data.tapToPayMessage != null ? String(data.tapToPayMessage) : undefined,
    };
  } catch {
    return { ok: false };
  }
}

export async function isDeviceBridgeTapToPayReady(): Promise<boolean> {
  const health = await getDeviceBridgeHealth();
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
        message: String(data.error || data.message || `Device Bridge HTTP ${res.status}`),
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
      message: aborted ? 'Payment cancelled.' : 'Could not reach Device Bridge.',
    };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener('abort', onAbort);
  }
}
