/** Staff PIN-gate branding — merchant mark top-right, Reborn wordmark in the footer only. */

export function merchantPinGateInitials(name?: string | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function pinGateMerchantLogoUrl(url?: string | null): string {
  return String(url || '').trim();
}
