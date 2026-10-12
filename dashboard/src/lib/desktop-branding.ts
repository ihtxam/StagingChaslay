export type DesktopBranding = {
  splashUrl: string;
  iconUrl: string;
  appName: string;
  tagline: string;
  backgroundColor: string;
  splashCustom?: boolean;
  iconCustom?: boolean;
};

export const DEFAULT_DESKTOP_BRANDING: DesktopBranding = {
  splashUrl: '/brand/reborn-logo-white.png',
  iconUrl: '/brand/reborn-logo-white.png',
  appName: 'RebornPOS',
  tagline: 'Restaurant POS & online ordering',
  backgroundColor: '#17252b',
};

export function normalizeDesktopBranding(raw: unknown): DesktopBranding {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const splashUrl = String(input.splashUrl || '').trim() || DEFAULT_DESKTOP_BRANDING.splashUrl;
  const iconUrl = String(input.iconUrl || '').trim() || splashUrl;
  return {
    splashUrl,
    iconUrl,
    appName: String(input.appName || '').trim() || DEFAULT_DESKTOP_BRANDING.appName,
    tagline: String(input.tagline || '').trim() || DEFAULT_DESKTOP_BRANDING.tagline,
    backgroundColor: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(input.backgroundColor || ''))
      ? String(input.backgroundColor)
      : DEFAULT_DESKTOP_BRANDING.backgroundColor,
    splashCustom: input.splashCustom === true,
    iconCustom: input.iconCustom === true,
  };
}

export async function fetchPublicDesktopBranding(): Promise<DesktopBranding> {
  const res = await fetch('/api/public/desktop-branding', { credentials: 'omit' });
  if (!res.ok) return DEFAULT_DESKTOP_BRANDING;
  const data = (await res.json()) as { branding?: unknown };
  return normalizeDesktopBranding(data.branding);
}
