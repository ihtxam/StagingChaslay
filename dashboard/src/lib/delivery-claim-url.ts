/** Parse driver claim params from a scanned QR URL or pasted link. */
export function parseDriverClaimUrl(raw: string): { orderId: string; token: string } | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const url = text.includes('://') ? new URL(text) : new URL(text, window.location.origin);
    const orderId = url.searchParams.get('claim') || '';
    const token = url.searchParams.get('token') || '';
    if (orderId && token) return { orderId, token };
  } catch {
    /* ignore */
  }
  const claimMatch = text.match(/[?&]claim=([^&]+)/i);
  const tokenMatch = text.match(/[?&]token=([^&]+)/i);
  if (claimMatch?.[1] && tokenMatch?.[1]) {
    return { orderId: decodeURIComponent(claimMatch[1]), token: decodeURIComponent(tokenMatch[1]) };
  }
  return null;
}
