export type CustomerDisplayLine = {
  name: string;
  qty: number;
  lineTotal: number;
  modifiers?: string;
};

export type CustomerDisplayPhase = 'idle' | 'building' | 'payment' | 'thankyou';

export type CustomerDisplayState = {
  merchantName?: string;
  currency: string;
  lines: CustomerDisplayLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  phase: CustomerDisplayPhase;
  updatedAt: number;
};

const WINDOW_NAME = 'reborn-customer-display';

export function cdsChannelName(token: string): string {
  return `reborn-cds:${String(token || '').trim()}`;
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

export function subscribeCustomerDisplayState(
  token: string,
  onState: (state: CustomerDisplayState) => void
): () => void {
  if (!token || typeof BroadcastChannel === 'undefined') return () => undefined;
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(cdsChannelName(token));
    channel.onmessage = (ev: MessageEvent<CustomerDisplayState>) => {
      if (ev.data && typeof ev.data === 'object') onState(ev.data);
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

export function cdsPublicUrl(token: string): string {
  const origin =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.rebornsense.com');
  return `${origin.replace(/\/$/, '')}/cds/${encodeURIComponent(token.trim())}`;
}

/** Open customer display on a second monitor when available (same till PC). */
export function openCustomerDisplayWindow(token: string): Window | null {
  if (!token || typeof window === 'undefined') return null;
  const url = cdsPublicUrl(token);
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
