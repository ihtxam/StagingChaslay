/**
 * Reborn table-reservation widget — one script tag for WordPress / any site.
 *
 * <script
 *   src="https://app.chaslay.com/embed/reborn-reservations.js"
 *   data-shop="your-merchant-slug"
 *   data-theme="light"
 *   data-lang="fr"
 *   data-label="Réserver une table"
 *   data-accent="#1c3557"
 *   async
 * ></script>
 */
(function rebornReservationsWidget() {
  if (window.RebornReservationsWidget) return;
  window.RebornReservationsWidget = { version: '1.0.0' };

  var script = document.currentScript;
  if (!script) return;

  var shop = String(script.getAttribute('data-shop') || '').trim();
  if (!shop) {
    console.warn('[reborn-reservations] missing data-shop');
    return;
  }

  var origin = String(script.getAttribute('data-base') || '').trim();
  if (!origin) {
    try {
      origin = new URL(script.src).origin;
    } catch (e) {
      origin = '';
    }
  }
  if (!origin) return;

  var theme = script.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  var lang = String(script.getAttribute('data-lang') || 'fr').trim();
  var label = String(script.getAttribute('data-label') || 'Réserver une table').trim();
  var accent = String(script.getAttribute('data-accent') || '').trim();
  var mode = String(script.getAttribute('data-mode') || 'reservation').trim();

  var fabBg = theme === 'dark' ? '#141414' : accent || '#1c3557';
  var fabText = theme === 'dark' ? '#fafaf9' : '#ffffff';

  var style = document.createElement('style');
  style.textContent =
    '.rbw-fab{position:fixed;z-index:2147483000;right:max(1rem,env(safe-area-inset-right));bottom:max(1rem,env(safe-area-inset-bottom));display:inline-flex;align-items:center;gap:.65rem;padding:.72rem 1.15rem;border-radius:999px;border:none;cursor:pointer;font:600 0.9rem/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 28px rgba(15,23,42,.22);transition:transform .15s,box-shadow .15s}' +
    '.rbw-fab:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(15,23,42,.28)}' +
    '.rbw-fab-icon{width:1.35rem;height:1.35rem;border-radius:6px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:.75rem}' +
    '.rbw-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;padding:0}' +
    '.rbw-frame-wrap{width:100%;max-width:440px;max-height:92vh;background:transparent;border-radius:16px 16px 0 0;overflow:hidden;animation:rbw-up .22s ease-out}' +
    '@keyframes rbw-up{from{transform:translateY(12px);opacity:.6}to{transform:none;opacity:1}}' +
    '.rbw-frame{width:100%;height:min(92vh,720px);border:0;display:block;background:#fff}' +
    '@media(min-width:640px){.rbw-overlay{align-items:center;padding:1rem}.rbw-frame-wrap{border-radius:16px;box-shadow:0 24px 64px rgba(15,23,42,.35)}.rbw-frame{height:min(88vh,760px)}}';
  document.head.appendChild(style);

  var fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'rbw-fab';
  fab.style.background = fabBg;
  fab.style.color = fabText;
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.innerHTML =
    '<span class="rbw-fab-icon" aria-hidden="true">✦</span><span>' + label + '</span>';

  var overlay = null;

  function closeOverlay() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.style.overflow = '';
  }

  function openOverlay() {
    if (mode === 'shop') {
      window.open(origin + '/shop/' + encodeURIComponent(shop), '_blank', 'noopener');
      return;
    }
    if (overlay) return;
    document.body.style.overflow = 'hidden';
    overlay = document.createElement('div');
    overlay.className = 'rbw-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay();
    });

    var wrap = document.createElement('div');
    wrap.className = 'rbw-frame-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', label);

    var iframe = document.createElement('iframe');
    iframe.className = 'rbw-frame';
    iframe.title = label;
    var qs = new URLSearchParams({ theme: theme, lang: lang, embed: '1' });
    if (accent) qs.set('accent', accent);
    iframe.src =
      origin +
      '/embed/reservations/' +
      encodeURIComponent(shop) +
      '?' +
      qs.toString();

    wrap.appendChild(iframe);
    overlay.appendChild(wrap);
    document.body.appendChild(overlay);
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.source !== 'reborn-reservations') return;
    if (data.type === 'close' || data.type === 'success') closeOverlay();
  });

  fab.addEventListener('click', openOverlay);
  document.body.appendChild(fab);
})();
