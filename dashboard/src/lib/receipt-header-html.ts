/** Receipt header in Settings is stored as HTML (HugeRTE) or legacy plain text. */

const HTML_TAG_RE = /<\s*[a-z][\s\S]*?>/i;
const HTML_ENTITY_RE = /&(?:#x?[0-9a-f]+|[a-z]+);/i;

export function receiptHeaderLooksLikeHtml(value: string): boolean {
  return HTML_TAG_RE.test(String(value || ''));
}

/** Decode `&egrave;`, `&#233;`, `&nbsp;`, etc. for thermal print (never print entity literals). */
export function decodeHtmlEntities(text: string): string {
  const raw = String(text ?? '');
  if (!raw || !HTML_ENTITY_RE.test(raw)) return raw;
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = raw;
    return textarea.value;
  }
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&agrave;/gi, 'à')
    .replace(/&acirc;/gi, 'â')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&auml;/gi, 'ä')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** HTML / plain → one printed row per block (preserves Enter and `<p>` / `<br>`). */
export function receiptHeaderContentToPlainText(value: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (!receiptHeaderLooksLikeHtml(raw)) {
    return decodeHtmlEntities(raw.replace(/\r\n/g, '\n'));
  }
  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = raw
      .replace(/\r\n/g, '\n')
      .replace(/<br\s*\/?>/gi, '<br>\n')
      .replace(/<\/p>\s*/gi, '</p>\n')
      .replace(/<\/div>\s*/gi, '</div>\n')
      .replace(/<\/h[1-6]>\s*/gi, '\n');
    const text = (container.innerText || container.textContent || '').replace(/\r\n/g, '\n');
    return text.replace(/\n{3,}/g, '\n\n').trim();
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
  html = decodeHtmlEntities(html);
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
