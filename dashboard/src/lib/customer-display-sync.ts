export type CustomerDisplayLine = {
  name: string;
  qty: number;
  lineTotal: number;
  modifiers?: string;
};

export type CustomerDisplayPhase = 'idle' | 'building' | 'payment' | 'thankyou';

/** POS / CDS UI languages (same set as panel i18n). */
export type CustomerDisplayLocale = 'en' | 'fr' | 'de';

export type CustomerDisplayState = {
  merchantName?: string;
  currency: string;
  lines: CustomerDisplayLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  phase: CustomerDisplayPhase;
  /** Public e-receipt URL shown on the thank-you screen. */
  receiptUrl?: string;
  /** POS panel language — CDS applies this so UI strings match the till. */
  locale?: CustomerDisplayLocale;
  updatedAt: number;
};

export type CdsUrlParts = {
  accessToken?: string;
  shortCode?: string | null;
};

/** localStorage key for last locale pushed from POS → CDS. */
export const CDS_LANG_KEY = 'reborn-cds-lang';

const CDS_REQUEST_KIND = 'cds-request' as const;

type CdsRequestMessage = { kind: typeof CDS_REQUEST_KIND };

const WINDOW_NAME = 'reborn-customer-display';

export function isCustomerDisplayLocale(value: unknown): value is CustomerDisplayLocale {
  return value === 'en' || value === 'fr' || value === 'de';
}

export function readPersistedCdsLocale(): CustomerDisplayLocale | null {
  try {
    const stored = localStorage.getItem(CDS_LANG_KEY);
    return isCustomerDisplayLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function persistCdsLocale(locale: CustomerDisplayLocale): void {
  if (!isCustomerDisplayLocale(locale)) return;
  try {
    localStorage.setItem(CDS_LANG_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function cdsChannelName(token: string): string {
  return `reborn-cds:${String(token || '').trim()}`;
}

function isCdsRequestMessage(data: unknown): data is CdsRequestMessage {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as CdsRequestMessage).kind === CDS_REQUEST_KIND
  );
}

function isCustomerDisplayStateMessage(data: unknown): data is CustomerDisplayState {
  return (
    !!data &&
    typeof data === 'object' &&
    !isCdsRequestMessage(data) &&
    typeof (data as CustomerDisplayState).phase === 'string' &&
    Array.isArray((data as CustomerDisplayState).lines)
  );
}

export function publishCustomerDisplayState(token: string, state: CustomerDisplayState): void {
  if (!token || typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(cdsChannelName(token));
    channel.postMessage(state);
    channel.close();
  } catch {
    /* ignore */
  }
}

/** CDS → POS: ask the till to republish the latest cart + locale. */
export function requestCustomerDisplayState(token: string): void {
  if (!token || typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(cdsChannelName(token));
    const msg: CdsRequestMessage = { kind: CDS_REQUEST_KIND };
    channel.postMessage(msg);
    channel.close();
  } catch {
    /* ignore */
  }
}

export function subscribeCustomerDisplayState(
  token: string,
  onState: (state: CustomerDisplayState) => void
): () => void {
  if (!token || typeof BroadcastChannel === 'undefined') return () => undefined;
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(cdsChannelName(token));
    channel.onmessage = (ev: MessageEvent<unknown>) => {
      if (isCustomerDisplayStateMessage(ev.data)) onState(ev.data);
    };
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      channel?.close();
    } catch {
      /* ignore */
    }
  };
}

/** POS: when CDS connects, republish current state (including locale). */
export function subscribeCustomerDisplayRequests(
  token: string,
  onRequest: () => void
): () => void {
  if (!token || typeof BroadcastChannel === 'undefined') return () => undefined;
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(cdsChannelName(token));
    channel.onmessage = (ev: MessageEvent<unknown>) => {
      if (isCdsRequestMessage(ev.data)) onRequest();
    };
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      channel?.close();
    } catch {
      /* ignore */
    }
  };
}

export function cdsPublicUrl(parts: string | CdsUrlParts): string {
  const origin =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.rebornsense.com');
  const code =
    typeof parts === 'string'
      ? parts.trim()
      : String(parts.shortCode || parts.accessToken || '').trim();
  return `${origin.replace(/\/$/, '')}/cds/${encodeURIComponent(code)}`;
}

/** Open customer display on a second monitor when available (same till PC). */
export function openCustomerDisplayWindow(parts: string | CdsUrlParts): Window | null {
  const code =
    typeof parts === 'string'
      ? parts.trim()
      : String(parts.shortCode || parts.accessToken || '').trim();
  if (!code || typeof window === 'undefined') return null;
  const url = cdsPublicUrl(parts);
  const screenLeft = window.screenLeft ?? window.screenX ?? 0;
  const screenTop = window.screenTop ?? window.screenY ?? 0;
  const width = Math.min(1280, window.screen.availWidth);
  const height = Math.min(800, window.screen.availHeight);
  const left = screenLeft + window.screen.availWidth;
  const features = [
    'noopener',
    'noreferrer',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${screenTop}`,
  ].join(',');
  const win = window.open(url, WINDOW_NAME, features);
  if (win) {
    try {
      win.focus();
    } catch {
      /* ignore */
    }
  }
  return win;
}
