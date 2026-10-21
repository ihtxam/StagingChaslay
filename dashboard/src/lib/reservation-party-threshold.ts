/** Online booking gate for party size vs merchant reservation settings. */

export type PartyBookingGate = {
  blocked: boolean;
  reason: 'below_min' | 'above_max' | 'call_threshold' | null;
};

export function resolveLargePartyCallThreshold(
  raw: number | null | undefined,
): number | null {
  if (raw == null) return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, n);
}

export function evaluatePartyBookingGate(
  partySize: number,
  minParty: number,
  maxParty: number,
  callThreshold: number | null,
): PartyBookingGate {
  const size = Math.floor(Number(partySize));
  if (!Number.isFinite(size)) {
    return { blocked: true, reason: 'below_min' };
  }
  if (size < minParty) return { blocked: true, reason: 'below_min' };
  if (size > maxParty) return { blocked: true, reason: 'above_max' };
  if (callThreshold != null && size >= callThreshold) {
    return { blocked: true, reason: 'call_threshold' };
  }
  return { blocked: false, reason: null };
}
