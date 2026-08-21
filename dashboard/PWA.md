# Install ChaslayReborn as a Windows app (PWA)

The merchant dashboard is a Progressive Web App. On Windows this gives you a **Start Menu / desktop shortcut** that opens ChaslayReborn in its own window (`display: standalone`), not a browser tab.

**PWA is the right first step.** Electron/Tauri would ship a full desktop runtime; a Chromium PWA reuses Edge/Chrome and is much lighter for ?double-click the POS.?

## Requirements

- **HTTPS** on the deployed panel host (or `localhost` for testing)
- **Microsoft Edge** or **Google Chrome** (Chromium)
- Built dashboard (`npm run build`) so the service worker registers in production

## Install on Windows (Edge or Chrome)

1. Open the panel URL and sign in as a merchant (e.g. `https://your-panel.example/login`).
2. Go to the POS: **`/merchant/pos`** (or open the installed app later - `start_url` is already `/merchant/pos`).
3. Install:
   - **Edge**: menu (?) ? **Apps** ? **Install this site as an app**  
     or click the **install** icon in the address bar.
   - **Chrome**: menu (?) ? **Cast, save, and share** ? **Install page as app?**  
     or the install icon in the address bar.
4. Confirm the name (**ChaslayReborn**).
5. Launch from the **Start Menu**, desktop shortcut, or taskbar pin.
6. Optional: in the app window menu, enable **Open as window** / fullscreen so it does not show browser chrome.

After install, double-clicking the app opens a frameless window at the POS. If the session expired, the app still loads and the panel redirects to login.

## What was added

| File | Role |
|------|------|
| `public/manifest.webmanifest` | Name, icons, `display: standalone`, `scope: /`, `start_url: /merchant/pos` |
| `public/sw.js` | App shell + hashed `/assets/*` cache for offline relaunch (`chaslay-shell-v5`) |
| `public/offline.html` | Fallback page when the shell is not cached yet |
| `src/lib/webpos-offline/*` | IndexedDB catalog snapshot + sale outbox; sync via `/sync/push-sales` |
| `public/icons/*`, `favicon.png` | Install / Start Menu icons |
| `index.html` | Manifest + theme / apple meta tags |
| `src/main.tsx` | Registers `/sw.js` in production builds |

### Offline selling (browser / PWA)

After at least one **successful online** visit to the POS (loads the app shell + catalog):

- Close and relaunch the installed PWA offline ? it should open from cache (not a blank page).
- If you see the offline fallback instead, reconnect once, open `/merchant/pos`, wait for the POS to load, then try offline again.

After at least one **successful online** catalog load:

- Opening the POS without network hydrates products/settings from IndexedDB.
- **Cash / card / express** sales can complete offline; they queue in the outbox and sync with `POST /sync/push-sales` (idempotent `clientId`) when online.
- **Blocked offline** (need cloud): terminal, gift cards, pay later, staff PIN unlock (if no prior session).
- Toggle off with `localStorage.setItem('manupos_webpos_offline','0')` if you want online-only.

## Configure start URL

Default start is the POS (`/merchant/pos`). The manifest `id` and `scope` are both `/` so refresh on `/merchant/*` routes stays inside the installed app window (not Chrome). Reinstall after manifest changes. To start at login instead, change `start_url` in `public/manifest.webmanifest` to `/login`, then rebuild and reinstall the app.

## Register staff session persistence

| Storage | Key | Purpose |
|---------|-----|---------|
| `sessionStorage` | `webpos_staff_session` | Active PIN session in this tab |
| `sessionStorage` | `webpos_staff_session_validated` | Set when PIN verify succeeds in this tab |
| `localStorage` | `webpos_staff_session_persist` | PWA offline relaunch only (not restored in browser tabs) |
| `localStorage` | `token` / `user` | Merchant login JWT (separate from PIN session) |

After login, PIN session is cleared. Owner/manager refresh without clock-in shows the PIN gate, not a stale waiter from `localStorage`.

## Uninstall

Edge/Chrome ? `edge://apps` or `chrome://apps` ? remove **ChaslayReborn**, or Windows **Settings ? Apps**.
