import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import AppErrorBoundary from './components/AppErrorBoundary'
import { ThemeProvider } from './lib/theme'
import { bindRebornPwaInstallGuard, probeRebornPwaInstalled } from './lib/pwa'
import { isShopStorefrontBoot, isShopStorefrontHost, unregisterRebornShellOnShop } from './lib/shop-storefront-host'
import { isDesktopApp } from './lib/platform'
import { installDesktopHardwareBridge } from './lib/hardware/desktop-bridge'
import './index.css'

if (typeof window !== 'undefined' && isDesktopApp()) {
  void installDesktopHardwareBridge();
  document.documentElement.classList.add('desktop-app-shell');
}

/** Recover from stale cached chunks after deploy (common cause of blank POS screens). */
if (import.meta.env.PROD && typeof window !== 'undefined') {
  const reloadOnce = () => {
    try {
      const key = 'webpos_chunk_reload';
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };
  window.addEventListener('vite:preloadError', reloadOnce);
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String((event.reason as { message?: string })?.message || event.reason || '');
    if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
      reloadOnce();
    }
  });
}

if (import.meta.env.PROD && typeof window !== 'undefined') {
  if (!isShopStorefrontBoot() && !isDesktopApp()) {
    probeRebornPwaInstalled();
    bindRebornPwaInstallGuard();
  }
}

/** Register SW before React boot so static assets get cached on the first online visit.
 * Shop storefronts must never install the POS offline shell — it hijacks custom domains. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  if (isDesktopApp()) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    }).catch(() => undefined);
  } else if (isShopStorefrontBoot()) {
    void unregisterRebornShellOnShop();
  } else if (!isShopStorefrontHost()) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        void reg.update();
        const onStateChange = () => {
          if (reg.waiting && navigator.serviceWorker.controller) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        };
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', onStateChange);
        });
        if (reg.waiting) onStateChange();
      })
      .catch(() => {
        /* installability still works with manifest alone in many cases */
      });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
)
