export const PLATFORM_MERCHANT_ABOUT_KEY = "platform_merchant_about_html";

/** Shown in merchant Settings → About until superadmin publishes custom HTML. */
export const DEFAULT_PLATFORM_MERCHANT_ABOUT_HTML = `<h2>WebPrintMedia</h2>
<p>Reborn POS is developed and supported by <strong>WebPrintMedia</strong> — restaurant and retail technology from Switzerland.</p>
<h3>Our other projects</h3>
<ul>
  <li><a href="https://swisspayout.com" target="_blank" rel="noopener noreferrer">Swisspayout.com</a></li>
  <li><a href="https://chaslay.com" target="_blank" rel="noopener noreferrer">Chaslay.com</a></li>
  <li><a href="https://vendlay.com" target="_blank" rel="noopener noreferrer">Vendlay.com</a></li>
  <li><a href="https://payvasta.com" target="_blank" rel="noopener noreferrer">Payvasta.com</a></li>
</ul>`;

export function normalizePlatformMerchantAboutHtml(raw: unknown): string {
  const trimmed = String(raw ?? "").trim();
  return trimmed || DEFAULT_PLATFORM_MERCHANT_ABOUT_HTML;
}
