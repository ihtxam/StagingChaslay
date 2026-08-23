/** Voice + bell alerts for the delivery management hub. */

let speechEnabled = true;

export function setDeliveryHubSpeechEnabled(on: boolean) {
  speechEnabled = on;
}

export function isDeliveryHubSpeechEnabled(): boolean {
  return speechEnabled;
}

export function speakDeliveryAlert(text: string) {
  if (!speechEnabled || typeof window === 'undefined') return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang =
      document.documentElement.lang.length === 2
        ? `${document.documentElement.lang}-${document.documentElement.lang === 'en' ? 'US' : document.documentElement.lang === 'fr' ? 'FR' : 'DE'}`
        : document.documentElement.lang || 'en-US';
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function playNewOrderBell() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    /* ignore */
  }
}

export function extractZipFromAddress(address?: string | null): string {
  if (!address) return '';
  const m = String(address).match(/\b(\d{4})\b/);
  return m?.[1] || '';
}

export function platformSpeechName(source?: string | null): string {
  const s = String(source || '').toLowerCase();
  if (s === 'justeat') return 'Just Eat';
  if (s === 'ubereats') return 'Uber Eats';
  if (s === 'online_shop') return 'online shop';
  return 'online';
}

export function newOrderSpeechLine(
  t: (key: string) => string,
  source?: string | null,
  zip?: string
): string {
  const platform = platformSpeechName(source);
  const zipPart = zip ? t('deliveryHubNewOrderZipPart').replace('{zip}', zip) : '';
  return t('deliveryHubNewOrderSpeech').replace('{platform}', platform).replace('{zipPart}', zipPart);
}

/** WebPOS till announcement for a new online shop order. */
export function onlineShopOrderSpeechLine(t: (key: string) => string, zip?: string): string {
  const code = zip?.trim() || t('deliveryHubUnknownZip');
  return t('webPosOnlineShopOrderSpeech').replace('{zip}', code);
}
