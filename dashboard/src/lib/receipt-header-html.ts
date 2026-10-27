/** Receipt header in Settings is stored as HTML (HugeRTE) or legacy plain text. */

const HTML_TAG_RE = /<\s*[a-z][\s\S]*?>/i;

export function receiptHeaderLooksLikeHtml(value: string): boolean {
  return HTML_TAG_RE.test(String(value || ''));
}

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** HTML / plain → one printed row per block (preserves Enter and `<p>` / `<br>`). */
export function receiptHeaderContentToPlainText(value: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (!receiptHeaderLooksLikeHtml(raw)) {
    return raw.replace(/\r\n/g, '\n');
  }
  let html = raw
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n')
    .replace(/<\/div>\s*/gi, '\n')
    .replace(/<\/h[1-6]>\s*/gi, '\n')
    .replace(/<\/li>\s*/gi, '\n')
    .replace(/<li[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');
  html = decodeBasicHtmlEntities(html);
  return html.replace(/\n{3,}/g, '\n\n').trim();
}

export function receiptHeaderContentToLines(value: string): string[] {
  const plain = receiptHeaderContentToPlainText(value);
  if (!plain) return [];
  const segments = plain.includes('\n')
    ? plain.split('\n')
    : /\\n/.test(plain)
      ? plain.split(/\\n/)
      : [plain];
  return segments
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((line) => line.slice(0, 200));
}

/** Load legacy plain multiline text into the rich editor. */
export function receiptHeaderHtmlForEditor(stored: string | null | undefined): string {
  const raw = String(stored ?? '').trim();
  if (!raw) return '';
  if (receiptHeaderLooksLikeHtml(raw)) return raw;
  const lines = raw.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isReceiptHeaderContentConfigured(
  headerTitle?: string | null,
  header?: string | null
): boolean {
  const title = String(headerTitle ?? '').trim();
  const bodyPlain = receiptHeaderContentToPlainText(String(header ?? ''));
  return !!(title || bodyPlain);
}
