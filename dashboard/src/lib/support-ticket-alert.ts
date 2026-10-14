export const SUPPORT_TICKET_ALERT_KIND = 'support_reply';

export function supportTicketAlertPath(ticketId: string): string {
  return `/merchant/support?ticket=${encodeURIComponent(ticketId)}`;
}

export function parseSupportTicketIdFromPath(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = url.startsWith('http://') || url.startsWith('https://')
      ? new URL(url)
      : new URL(url, 'https://panel.local');
    if (parsed.pathname.replace(/\/$/, '') !== '/merchant/support') return null;
    const id = parsed.searchParams.get('ticket')?.trim();
    return id || null;
  } catch {
    return null;
  }
}

export function isInternalPanelPath(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith('/') && !url.startsWith('//');
}
