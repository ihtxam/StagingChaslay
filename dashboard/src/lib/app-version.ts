import { APP_NAME } from '@/lib/brand';

/** Injected from dashboard/package.json at build time via vite.config.ts */
declare const __APP_VERSION__: string;
declare const __BUILD_STAMP__: string;

export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

/** Short git SHA (or ISO timestamp) baked into dist/index.html at `vite build`. */
export const PANEL_BUILD_STAMP =
  typeof __BUILD_STAMP__ !== 'undefined' ? __BUILD_STAMP__ : 'dev';

export const dashboardVersionLabel = `Dashboard v${APP_VERSION}`;

export const panelBuildLabel = `Panel build: ${PANEL_BUILD_STAMP}`;

export const webPosVersionLabel = `${APP_NAME} v${APP_VERSION}`;
