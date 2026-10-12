export function isResellerOwnedTicket(ticket: {
  requesterRole?: string | null;
  merchantId?: string | null;
  merchant?: { name?: string } | null;
}): boolean {
  if (ticket.requesterRole === 'reseller') return true;
  if (ticket.requesterRole === 'merchant') return false;
  return !ticket.merchantId && !ticket.merchant;
}

export function supportTicketOwnerTitle(ticket: {
  requesterRole?: string | null;
  merchantId?: string | null;
  merchant?: { name?: string } | null;
  reseller?: { name?: string } | null;
  subject: string;
}): string {
  if (isResellerOwnedTicket(ticket)) {
    return ticket.reseller?.name || ticket.subject;
  }
  return ticket.merchant?.name || ticket.subject;
}
