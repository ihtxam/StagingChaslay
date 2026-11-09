import { APP_NAME } from '@/lib/brand';

/** Injected from dashboard/package.json at build time via vite.config.ts */
declare const __APP_VERSION__: string;
declare const __BUILD_STAMP__: string;
declare const __PANEL_BUILD_TAG__: string;

export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

/** Short git SHA (or ISO timestamp) baked into dist/index.html at `vite build`. */
export const PANEL_BUILD_STAMP =
  typeof __BUILD_STAMP__ !== 'undefined' ? __BUILD_STAMP__ : 'dev';

/** Dated rebuild suffix, e.g. `v091126.3` (Europe/Zurich, set at `vite build`). */
export const PANEL_BUILD_TAG =
  typeof __PANEL_BUILD_TAG__ !== 'undefined' ? __PANEL_BUILD_TAG__ : 'vdev.1';

export const dashboardVersionLabel = `Dashboard v${APP_VERSION}`;

export const panelBuildLabel = `Panel build: ${PANEL_BUILD_STAMP} ${PANEL_BUILD_TAG}`;

export const webPosVersionLabel = `${APP_NAME} v${APP_VERSION}`;
