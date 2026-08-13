/** Adyen Terminal API receipt lines for WebPOS thermal printing. */

export type AdyenReceiptLine = {
  text: string;
  bold?: boolean;
  centered?: boolean;
  endOfLine?: boolean;
};

export type AdyenTerminalReceipt = {
  documentQualifier: string;
  lines: AdyenReceiptLine[];
};

function urlDecode(value: string): string {
  try {
    return decodeURIComponent(String(value).replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function leftRight(left: string, right: string, width: number): string {
  const leftText = left.slice(0, width - right.length - 1);
  const padding = Math.max(1, width - leftText.length - right.length);
  return leftText + ' '.repeat(padding) + right;
}

function renderLine(rawText: string, width: number): string {
  const decoded = urlDecode(rawText);
  if (!decoded.includes('=')) return decoded;

  const params = new URLSearchParams();
  for (const part of decoded.split('&')) {
    const [k, ...rest] = part.split('=');
    if (k) params.set(k.trim(), urlDecode(rest.join('=').trim()));
  }

  const key = (params.get('key') || '').toLowerCase();
  const name = params.get('name') || '';
  const value = params.get('value') || '';

  switch (key) {
    case 'filler':
    case 'signature':
      return '';
    case 'sigline':
    case 'merchantsigline':
      return '_'.repeat(Math.min(28, width));
    case 'header1':
    case 'header2':
    case 'thanks':
    case 'approved':
    case 'refused':
    case 'void':
    case 'cardholderheader':
      return value || name;
    default:
      if (name && value) return leftRight(name, value, width);
      return name || value || '';
  }
}

function center(text: string, width: number): string {
  if (text.length >= width) return text;
  const pad = Math.floor((width - text.length) / 2);
  return ' '.repeat(Math.max(0, pad)) + text;
}

export function adyenReceiptToPlainText(
  receipt: AdyenTerminalReceipt,
  lineWidth = 32
): string {
  let out = '';
  let pending = '';
  for (const line of receipt.lines) {
    let segment = line.text;
    if (line.centered) segment = center(segment, lineWidth);
    else if (line.bold) segment = segment.toUpperCase();

    if (line.endOfLine !== false) {
      out += pending + segment + '\n';
      pending = '';
    } else {
      pending += segment;
    }
  }
  if (pending) out += pending + '\n';
  return out + '\n';
}

export function appendAdyenReceiptBlock(
  receiptText: string,
  receipt: AdyenTerminalReceipt | null | undefined,
  lineWidth = 32
): string {
  if (!receipt?.lines?.length) return receiptText;
  const thin = '-'.repeat(Math.min(lineWidth, 32));
  return receiptText + thin + '\n' + adyenReceiptToPlainText(receipt, lineWidth);
}

/** Normalize backend / terminal POI receipt payload for printing. */
export function normalizeAdyenTerminalReceipt(raw: unknown): AdyenTerminalReceipt | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as AdyenTerminalReceipt;
  if (!Array.isArray(r.lines)) return null;
  return r;
}
