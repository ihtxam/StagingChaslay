import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme'
import './index.css'

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

/** Register SW before React boot so static assets get cached on the first online visit. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* installability still works with manifest alone in many cases */
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
