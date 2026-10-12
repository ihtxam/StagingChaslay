import type { Data } from '@measured/puck';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function looksLikeHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s);
}

function headingInner(text: string): string {
  const raw = String(text || '').trim();
  if (!raw) return '';
  const unwrapped = raw.replace(/^<p[^>]*>([\s\S]*)<\/p>$/i, '$1');
  return looksLikeHtml(unwrapped) ? unwrapped : escapeHtml(unwrapped);
}

function buttonInner(label: string): string {
  const raw = String(label || 'Click').trim() || 'Click';
  const unwrapped = raw.replace(/^<p[^>]*>([\s\S]*)<\/p>$/i, '$1');
  return looksLikeHtml(unwrapped) ? unwrapped : escapeHtml(unwrapped);
}

/** Make uploaded `/api/uploads/…` paths absolute so inboxes can load them. */
export function emailAssetUrl(url: string): string {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u) || u.startsWith('{{') || u.startsWith('data:')) return u;
  if (u.startsWith('/') && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${u}`;
  }
  return u;
}

function headingMetrics(level: unknown): { tag: string; size: string; pad: string } {
  if (level === 'h3') return { tag: 'h3', size: '18px', pad: '12px 28px 6px' };
  if (level === 'h2') return { tag: 'h2', size: '22px', pad: '16px 28px 8px' };
  return { tag: 'h1', size: '28px', pad: '24px 28px 8px' };
}

function buttonPad(size: unknown): { pad: string; fontSize: string } {
  if (size === 'sm') return { pad: '8px 14px', fontSize: '13px' };
  if (size === 'lg') return { pad: '16px 26px', fontSize: '17px' };
  return { pad: '14px 22px', fontSize: '15px' };
}

/** Convert visual newsletter blocks to email-safe table HTML. */
export function buildPuckNewsletterEmailHtml(data: Data, title = 'Newsletter'): string {
  const blocks = Array.isArray(data.content) ? data.content : [];
  const inner = blocks
    .map((block) => {
      const props = (block.props || {}) as Record<string, unknown>;
      if (block.type === 'Heading') {
        const { tag, size, pad } = headingMetrics(props.level);
        return `<tr><td style="padding:${pad};font-family:Georgia,serif;"><${tag} style="margin:0;font-size:${size};line-height:1.25;color:#0c0a09;">${headingInner(String(props.text || ''))}</${tag}></td></tr>`;
      }
      if (block.type === 'Text') {
        const content = String(props.content || '');
        return `<tr><td style="padding:0 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.55;color:#44403c;">${content}</td></tr>`;
      }
      if (block.type === 'Image') {
        const src = emailAssetUrl(String(props.src || ''));
        if (!src) return '';
        const alt = escapeHtml(String(props.alt || ''));
        const href = emailAssetUrl(String(props.href || ''));
        const img = `<img src="${escapeHtml(src)}" alt="${alt}" width="504" style="display:block;width:100%;max-width:504px;height:auto;border:0;" />`;
        const body = href
          ? `<a href="${escapeHtml(href)}" style="text-decoration:none;">${img}</a>`
          : img;
        return `<tr><td style="padding:8px 28px 16px;" align="center">${body}</td></tr>`;
      }
      if (block.type === 'Button') {
        const label = buttonInner(String(props.label || 'Click'));
        const url = escapeHtml(String(props.url || '{{shopUrl}}'));
        const color = /^#[0-9a-fA-F]{3,8}$/.test(String(props.color || ''))
          ? String(props.color)
          : '#0f766e';
        const metrics = buttonPad(props.size);
        return `<tr><td style="padding:8px 28px 16px;"><a href="${url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:700;padding:${metrics.pad};font-size:${metrics.fontSize};border-radius:8px;">${label}</a></td></tr>`;
      }
      if (block.type === 'Spacer') {
        const h = Math.max(8, Math.min(120, Number(props.height) || 24));
        return `<tr><td style="height:${h}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
      }
      return '';
    })
    .join('');

  const headline = escapeHtml(title);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light"/>
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;color:#1c1917;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e7e5e4;overflow:hidden;">
          <tr>
            <td style="height:6px;background:#0f766e;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          ${inner}
          <tr>
            <td style="padding:20px 28px;border-top:1px solid #e7e5e4;background:#fafaf9;font-size:12px;color:#78716c;">
              <p style="margin:0;">© ${year} {{businessName}} · <a href="{{shopUrl}}" style="color:#0f766e;">Website</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
