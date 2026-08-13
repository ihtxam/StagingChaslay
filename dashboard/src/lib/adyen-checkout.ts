export type AdyenPaymentSession = {
  id: string;
  sessionData: string;
  clientKey: string;
  environment?: string;
};

export type MountAdyenDropinOptions = {
  session: AdyenPaymentSession;
  container: HTMLElement;
  onPaymentCompleted: (result: { resultCode?: string }) => void | Promise<void>;
  onError?: (err: { message?: string }) => void;
  locale?: string;
  countryCode?: string;
};

/** Normalize checkout API payload (camelCase or snake_case). */
export function normalizeAdyenPaymentSession(raw: unknown): AdyenPaymentSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? r.sessionId ?? '').trim();
  const sessionData = String(r.sessionData ?? r.session_data ?? '').trim();
  const clientKey = String(r.clientKey ?? r.client_key ?? '').trim();
  const environment = r.environment != null ? String(r.environment) : undefined;
  if (!id || !sessionData || !clientKey) return null;
  return { id, sessionData, clientKey, environment };
}

function explainAdyenUnauthorized(raw: string, context?: 'dropin' | 'checkout'): string {
  const envHint = raw.includes('live') ? 'LIVE' : 'TEST';
  const keyPrefix = envHint === 'LIVE' ? 'live_' : 'test_';
  const where =
    context === 'dropin'
      ? 'Adyen Drop-in could not load the payment session (Unauthorized).'
      : 'Adyen checkout was rejected (Unauthorized).';
  return (
    `${where} The platform API key, merchant account, and client key must all belong to the same ${envHint} Adyen account. ` +
    `In Superadmin → Settings → Payment (Adyen): use the Web service API key (AQE…), merchant account name, and client key (${keyPrefix}…). ` +
    `Merchant shop credentials under Settings → Payments are separate and will not work for subscriptions.`
  );
}

export function formatAdyenError(err: unknown, context?: 'dropin' | 'checkout'): string {
  let raw = '';
  if (err instanceof Error) raw = err.message;
  else if (typeof err === 'string') raw = err;
  else if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string') raw = o.message;
    else if (typeof o.error === 'string') raw = o.error;
    else if (typeof o.name === 'string' && typeof o.message === 'string') {
      raw = `${o.name}: ${o.message}`;
    } else {
      try {
        raw = JSON.stringify(err);
      } catch {
        raw = String(err);
      }
    }
  } else {
    return 'Unknown Adyen error';
  }

  if (/unauthorized/i.test(raw) || /HTTP Status Response - Unauthorized/i.test(raw)) {
    return explainAdyenUnauthorized(raw, context);
  }
  return raw;
}

function adyenEnvironmentFromClientKey(clientKey: string): 'live' | 'test' {
  return clientKey.trim().startsWith('live_') ? 'live' : 'test';
}

function resolveAdyenEnvironment(session: AdyenPaymentSession): 'live' | 'test' {
  return adyenEnvironmentFromClientKey(session.clientKey);
}

async function loadAdyenCheckoutCtor(): Promise<
  (config: Record<string, unknown>) => Promise<{ create: (type: string) => { mount: (el: HTMLElement) => void } }>
> {
  const mod = (await import('@adyen/adyen-web')) as {
    default?: unknown;
    AdyenCheckout?: unknown;
  };
  const ctor = mod.AdyenCheckout ?? mod.default;
  if (typeof ctor !== 'function') {
    throw new Error(
      'Adyen Web library failed to load (missing AdyenCheckout export). Rebuild the dashboard after npm install.'
    );
  }
  return ctor as (config: Record<string, unknown>) => Promise<{
    create: (type: string) => { mount: (el: HTMLElement) => void };
  }>;
}

/** Mount Adyen Drop-in for a /sessions response. Throws with a readable message on failure. */
export async function mountAdyenDropin({
  session,
  container,
  onPaymentCompleted,
  onError,
  locale = 'de-CH',
  countryCode = 'CH',
}: MountAdyenDropinOptions): Promise<void> {
  const clientKey = session.clientKey?.trim();
  if (!clientKey) {
    throw new Error('Missing Adyen client key. Set it in Superadmin → Settings → Payment (Adyen).');
  }
  if (clientKey.startsWith('AQE') || (!clientKey.startsWith('test_') && !clientKey.startsWith('live_'))) {
    throw new Error(
      'Invalid Adyen client key. Use the Client Key from Adyen Customer Area (starts with test_ or live_), not the API key.'
    );
  }
  if (!session.id || !session.sessionData) {
    throw new Error('Payment session is incomplete (missing id or sessionData). Try checkout again.');
  }

  await import(/* @vite-ignore */ '@adyen/adyen-web/dist/adyen.css').catch(() => undefined);

  const AdyenCheckout = await loadAdyenCheckoutCtor();
  const environment = resolveAdyenEnvironment(session);

  let checkout: { create: (type: string) => { mount: (el: HTMLElement) => void } };
  try {
    checkout = await AdyenCheckout({
      environment,
      clientKey,
      locale,
      countryCode,
      session: { id: session.id, sessionData: session.sessionData },
      onPaymentCompleted,
      onPaymentFailed: (result: { resultCode?: string }) => {
        onError?.({ message: `Payment failed (${result?.resultCode || 'unknown'})` });
      },
      onError: (error: unknown) => {
        onError?.({ message: formatAdyenError(error, 'dropin') });
      },
    });
  } catch (err) {
    throw new Error(
      `Adyen Checkout init failed (${environment}, key ${clientKey.slice(0, 8)}…): ${formatAdyenError(err, 'dropin')}`
    );
  }

  try {
    checkout.create('dropin').mount(container);
  } catch (err) {
    throw new Error(`Adyen Drop-in mount failed: ${formatAdyenError(err, 'dropin')}`);
  }
}
