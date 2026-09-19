import type { Data } from '@measured/puck';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert Puck newsletter blocks to email-safe table HTML. */
export function buildPuckNewsletterEmailHtml(data: Data, title = 'Newsletter'): string {
  const blocks = Array.isArray(data.content) ? data.content : [];
  const inner = blocks
    .map((block) => {
      const props = (block.props || {}) as Record<string, unknown>;
      if (block.type === 'Heading') {
        const text = escapeHtml(String(props.text || ''));
        const level = props.level === 'h2' ? 'h2' : 'h1';
        const size = level === 'h2' ? '22px' : '28px';
        const pad = level === 'h2' ? '16px 28px 8px' : '24px 28px 8px';
        return `<tr><td style="padding:${pad};font-family:Georgia,serif;"><${level} style="margin:0;font-size:${size};line-height:1.25;color:#0c0a09;">${text}</${level}></td></tr>`;
      }
      if (block.type === 'Text') {
        const content = String(props.content || '');
        return `<tr><td style="padding:0 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.55;color:#44403c;">${content}</td></tr>`;
      }
      if (block.type === 'Button') {
        const label = escapeHtml(String(props.label || 'Click'));
        const url = escapeHtml(String(props.url || '{{shopUrl}}'));
        const color = /^#[0-9a-fA-F]{3,8}$/.test(String(props.color || ''))
          ? String(props.color)
          : '#0f766e';
        return `<tr><td style="padding:8px 28px 16px;"><a href="${url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px;">${label}</a></td></tr>`;
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
