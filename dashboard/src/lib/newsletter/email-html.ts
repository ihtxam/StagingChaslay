/** Native newsletter design — email-safe, not a website page export. */
export type NativeNewsletterDesign = {
  engine: 'native';
  headline: string;
  intro: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
  accentColor: string;
};

export function defaultNativeNewsletter(title = 'Newsletter'): NativeNewsletterDesign {
  return {
    engine: 'native',
    headline: title || 'Newsletter',
    intro: 'A quick update from us.',
    body: 'Share your news, offers, and what’s cooking this week.',
    ctaLabel: 'Order online',
    ctaUrl: '{{shopUrl}}',
    footerNote: 'You’re receiving this because you ordered from {{businessName}}.',
    accentColor: '#0f766e',
  };
}

export function isNativeNewsletterDesign(raw: unknown): raw is NativeNewsletterDesign {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return o.engine === 'native' && typeof o.headline === 'string';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Split body into paragraphs; keep blank lines as spacing. */
function bodyParagraphs(body: string): string {
  const parts = String(body || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  return parts
    .map((p) => {
      const lines = escapeHtml(p).replace(/\n/g, '<br/>');
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1c1917;">${lines}</p>`;
    })
    .join('');
}

/**
 * Table-based, inline-styled HTML that works in Gmail / Apple Mail / Outlook.
 * Light background, dark text — never dark-on-dark.
 */
export function buildNewsletterEmailHtml(design: NativeNewsletterDesign): string {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(design.accentColor || '')
    ? design.accentColor
    : '#0f766e';
  const headline = escapeHtml(design.headline || 'Newsletter');
  const intro = escapeHtml(design.intro || '');
  const ctaLabel = escapeHtml(design.ctaLabel || 'Order online');
  const ctaUrl = escapeHtml(design.ctaUrl || '{{shopUrl}}');
  const footer = escapeHtml(design.footerNote || '');
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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${intro}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4;">
          <tr>
            <td style="height:6px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;font-family:Georgia,'Times New Roman',serif;">
              <h1 style="margin:0 0 12px;font-size:28px;line-height:1.25;color:#0c0a09;font-weight:700;">${headline}</h1>
              ${
                intro
                  ? `<p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.5;color:#57534e;">${intro}</p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              ${bodyParagraphs(design.body)}
            </td>
          </tr>
          ${
            design.ctaLabel
              ? `<tr>
            <td style="padding:8px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" align="left">
              <a href="${ctaUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;border-radius:8px;">${ctaLabel}</a>
            </td>
          </tr>`
              : ''
          }
          <tr>
            <td style="padding:20px 28px;border-top:1px solid #e7e5e4;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.5;color:#78716c;">
              ${footer ? `<p style="margin:0 0 8px;">${footer}</p>` : ''}
              <p style="margin:0;">© ${year} {{businessName}} · <a href="{{shopUrl}}" style="color:${accent};">Website</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
