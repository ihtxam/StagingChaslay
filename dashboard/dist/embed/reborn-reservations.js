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
 *   data-scroll-reveal="true"
 *   data-scroll-threshold="320"
 *   data-scroll-ratio="0.2"
 *   data-scroll-peek="true"
 *   data-scroll-auto-open="false"
 *   async
 * ></script>
 */
(function rebornReservationsWidget() {
  if (window.RebornReservationsWidget) return;
  window.RebornReservationsWidget = { version: '1.1.0' };

  var SESSION_AUTO = 'reborn_resa_scroll_auto_open_done';
  var SESSION_DISMISS = 'reborn_resa_scroll_dismissed';
  var DEFAULT_THRESHOLD = 320;
  var DEFAULT_SCROLL_RATIO = 0.2;
  var DEFAULT_AUTO_DELAY = 2200;

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

  var scrollReveal = script.getAttribute('data-scroll-reveal') === 'true';
  var scrollThreshold = parseInt(script.getAttribute('data-scroll-threshold') || '', 10);
  if (!scrollThreshold || scrollThreshold < 0) scrollThreshold = DEFAULT_THRESHOLD;
  var scrollPeek =
    scrollReveal && script.getAttribute('data-scroll-peek') !== 'false';
  var scrollRatio = parseFloat(script.getAttribute('data-scroll-ratio') || '');
  if (!scrollRatio || scrollRatio <= 0) scrollRatio = DEFAULT_SCROLL_RATIO;
  var scrollAutoOpen =
    scrollReveal && script.getAttribute('data-scroll-auto-open') === 'true';
  var autoOpenDelay = parseInt(script.getAttribute('data-scroll-auto-open-delay') || '', 10);
  if (!autoOpenDelay || autoOpenDelay < 0) autoOpenDelay = DEFAULT_AUTO_DELAY;

  var reducedMotion = false;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    reducedMotion = false;
  }

  var fabBg = theme === 'dark' ? '#141414' : accent || '#1c3557';
  var fabText = theme === 'dark' ? '#fafaf9' : '#ffffff';

  var style = document.createElement('style');
  style.textContent =
    '.rbw-fab{position:fixed;z-index:2147483000;right:max(1rem,env(safe-area-inset-right));bottom:max(1rem,env(safe-area-inset-bottom));display:inline-flex;align-items:center;gap:.65rem;padding:.72rem 1.15rem;border-radius:999px;border:none;cursor:pointer;font:600 0.9rem/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 28px rgba(15,23,42,.22);transition:transform .15s,box-shadow .15s,opacity .3s}' +
    '.rbw-fab:hover{transform:translateY(-1px);box-shadow:0 14px 32px rgba(15,23,42,.28)}' +
    '.rbw-fab.rbw-fab--hidden{opacity:0;pointer-events:none;transform:translateY(10px)}' +
    '.rbw-fab.rbw-fab--pulse{animation:rbw-fab-pulse 1.05s ease-in-out 2}' +
    '@keyframes rbw-fab-pulse{0%,100%{box-shadow:0 10px 28px rgba(15,23,42,.22)}50%{box-shadow:0 10px 28px rgba(15,23,42,.22),0 0 0 10px rgba(28,53,87,.18)}}' +
    '.rbw-fab-icon{width:1.35rem;height:1.35rem;border-radius:6px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:.75rem}' +
    '.rbw-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;padding:0;animation:rbw-fade-in .2s ease-out}' +
    '@keyframes rbw-fade-in{from{opacity:.6}to{opacity:1}}' +
    '.rbw-frame-wrap{width:100%;max-width:min(100vw - 2rem,580px);max-height:92vh;background:transparent;border-radius:16px 16px 0 0;overflow:hidden;animation:rbw-up .3s ease-out}' +
    '@keyframes rbw-up{from{transform:translateY(16px);opacity:.55}to{transform:none;opacity:1}}' +
    '.rbw-frame{width:100%;height:min(92vh,680px);border:0;display:block;background:#fff}' +
    '.rbw-peek{position:fixed;z-index:2147482999;left:0;right:0;bottom:max(.35rem,env(safe-area-inset-bottom));display:flex;justify-content:center;padding:0 .75rem;pointer-events:none;opacity:0;transform:translateY(14px);transition:opacity .35s,transform .35s}' +
    '.rbw-peek.rbw-peek--on{opacity:1;transform:none;pointer-events:auto}' +
    '.rbw-peek-card{width:100%;max-width:32rem;background:#fff;border-radius:16px;border:1px solid rgba(15,23,42,.08);box-shadow:0 16px 48px rgba(15,23,42,.22);overflow:hidden;transform:translateY(46%);transition:transform .45s cubic-bezier(.22,1,.36,1)}' +
    '.rbw-peek.rbw-peek--on .rbw-peek-card{transform:translateY(46%)}' +
    '.rbw-peek-head{display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;cursor:pointer;border:0;background:transparent;width:100%;text-align:left;font:inherit}' +
    '.rbw-peek-meta{font-size:.72rem;color:#64748b;margin-top:.15rem}' +
    '.rbw-peek-cta{margin:.5rem 1rem 1rem;width:calc(100% - 2rem);padding:.65rem;border-radius:12px;border:none;color:#fff;font:600 .85rem system-ui;cursor:pointer}' +
    '@media(min-width:640px){.rbw-overlay{align-items:center;padding:1rem}.rbw-frame-wrap{border-radius:16px;box-shadow:0 24px 64px rgba(15,23,42,.35)}.rbw-frame{height:min(86vh,700px)}}';
  document.head.appendChild(style);

  var fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'rbw-fab' + (scrollReveal && !reducedMotion ? ' rbw-fab--hidden' : '');
  fab.style.background = fabBg;
  fab.style.color = fabText;
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.innerHTML =
    '<span class="rbw-fab-icon" aria-hidden="true">✦</span><span>' + label + '</span>';

  var overlay = null;
  var peekEl = null;
  var fabRevealed = !scrollReveal || reducedMotion;
  var autoOpenTimer = null;

  function effectiveScrollThreshold() {
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return Math.max(scrollThreshold, Math.floor(maxScroll * scrollRatio));
  }

  function sessionFlag(key) {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch (e) {
      return false;
    }
  }

  function markDismissed() {
    try {
      sessionStorage.setItem(SESSION_DISMISS, '1');
      sessionStorage.setItem(SESSION_AUTO, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function markAutoDone() {
    try {
      sessionStorage.setItem(SESSION_AUTO, '1');
    } catch (e) {
      /* ignore */
    }
  }

  function clearAutoOpenTimer() {
    if (autoOpenTimer) {
      clearTimeout(autoOpenTimer);
      autoOpenTimer = null;
    }
  }

  function scheduleAutoOpen() {
    if (!scrollAutoOpen || reducedMotion) return;
    if (sessionFlag(SESSION_AUTO) || sessionFlag(SESSION_DISMISS)) return;
    clearAutoOpenTimer();
    autoOpenTimer = setTimeout(function () {
      autoOpenTimer = null;
      if (sessionFlag(SESSION_AUTO) || sessionFlag(SESSION_DISMISS)) return;
      markAutoDone();
      openOverlay();
    }, autoOpenDelay);
  }

  function showPeek() {
    if (!scrollPeek || sessionFlag(SESSION_DISMISS) || peekEl) return;
    fab.classList.add('rbw-fab--hidden');
    fab.setAttribute('aria-hidden', 'true');
    peekEl = document.createElement('div');
    peekEl.className = 'rbw-peek';
    var today =
      lang === 'de' ? 'Heute' : lang === 'en' ? 'Today' : "Aujourd'hui";
    var guests = lang === 'de' ? '2 Gäste' : lang === 'en' ? '2 guests' : '2 pers.';
    var cta =
      lang === 'de' ? 'Uhrzeit wählen' : lang === 'en' ? 'Choose a time' : 'Choisir une heure';
    peekEl.innerHTML =
      '<div class="rbw-peek-card" role="complementary">' +
      '<button type="button" class="rbw-peek-head">' +
      '<span class="rbw-fab-icon" style="background:' +
      fabBg +
      ';color:' +
      fabText +
      '">✦</span>' +
      '<span><strong>' +
      label +
      '</strong><div class="rbw-peek-meta">' +
      guests +
      ' · ' +
      today +
      '</div></span></button>' +
      '<button type="button" class="rbw-peek-cta" style="background:' +
      fabBg +
      '">' +
      cta +
      '</button></div>';
    peekEl.querySelector('.rbw-peek-head').addEventListener('click', function () {
      markAutoDone();
      openOverlay();
    });
    peekEl.querySelector('.rbw-peek-cta').addEventListener('click', function () {
      markAutoDone();
      openOverlay();
    });
    document.body.appendChild(peekEl);
    requestAnimationFrame(function () {
      peekEl.classList.add('rbw-peek--on');
    });
  }

  function hidePeek() {
    if (!peekEl) return;
    peekEl.remove();
    peekEl = null;
  }

  function revealFab() {
    if (fabRevealed) return;
    fabRevealed = true;
    if (!reducedMotion) {
      fab.classList.add('rbw-fab--pulse');
      setTimeout(function () {
        fab.classList.remove('rbw-fab--pulse');
      }, 2400);
    }
    if (scrollPeek && !sessionFlag(SESSION_DISMISS)) {
      showPeek();
    } else {
      fab.classList.remove('rbw-fab--hidden');
      fab.setAttribute('aria-hidden', 'false');
    }
    scheduleAutoOpen();
  }

  function onScrollReveal() {
    if (fabRevealed) return;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y >= effectiveScrollThreshold()) revealFab();
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.style.overflow = '';
    markDismissed();
    clearAutoOpenTimer();
    hidePeek();
    fab.classList.remove('rbw-fab--hidden');
    fab.setAttribute('aria-hidden', 'false');
  }

  function openOverlay() {
    if (mode === 'shop') {
      window.open(origin + '/shop/' + encodeURIComponent(shop), '_blank', 'noopener');
      return;
    }
    if (overlay) return;
    markAutoDone();
    clearAutoOpenTimer();
    hidePeek();
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

  fab.addEventListener('click', function () {
    markAutoDone();
    clearAutoOpenTimer();
    hidePeek();
    openOverlay();
  });
  document.body.appendChild(fab);

  if (scrollReveal && !reducedMotion) {
    fab.setAttribute('aria-hidden', 'true');
    onScrollReveal();
    window.addEventListener('scroll', onScrollReveal, { passive: true });
  }
})();
