export const SUPPORT_REPLY_MESSAGE_KIND = 'support_reply';

export function isResellerOwnedTicket(ticket: {
  requesterRole?: string | null;
  merchantId?: string | null;
}): boolean {
  if (ticket.requesterRole === 'reseller') return true;
  if (ticket.requesterRole === 'merchant') return false;
  return !ticket.merchantId;
}

/** Requester reply re-opens; support reply marks answered. */
export function supportTicketStatusAfterReply(opts: {
  closeTicket?: boolean;
  authorRole: string;
  requesterRole?: string | null;
  merchantId?: string | null;
}): 'open' | 'answered' | 'closed' {
  if (opts.closeTicket) return 'closed';
  if (isResellerOwnedTicket(opts)) {
    return opts.authorRole === 'reseller' ? 'open' : 'answered';
  }
  return opts.authorRole === 'merchant' ? 'open' : 'answered';
}

export function supportAttachmentOwnerKey(opts: {
  merchantId?: string | null;
  resellerId?: string | null;
}): string {
  if (opts.merchantId) return opts.merchantId;
  if (opts.resellerId) return `reseller/${opts.resellerId}`;
  throw new Error('Missing upload owner');
}

export function resellerTicketAlertPath(ticketId: string): string {
  return `/reseller/support?ticket=${encodeURIComponent(ticketId)}`;
}

export function parseResellerTicketIdFromPath(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed =
      url.startsWith('http://') || url.startsWith('https://')
        ? new URL(url)
        : new URL(url, 'https://panel.local');
    if (parsed.pathname.replace(/\/$/, '') !== '/reseller/support') return null;
    const id = parsed.searchParams.get('ticket')?.trim();
    return id || null;
  } catch {
    return null;
  }
}
