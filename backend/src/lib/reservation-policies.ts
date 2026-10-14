/** Deposits, cancellation window, waitlist quote, guest SMS, Google Reserve publish. */

export type ReservationPolicySettings = {
  waitlistSmsEnabled?: boolean;
  waitlistQuoteMinutes?: number | null;
  depositEnabled?: boolean;
  depositAmount?: number | null;
  depositType?: "fixed" | "percent";
  cancelHoursBefore?: number | null;
  googleReservePublish?: boolean;
};

export type ReservationExtras = {
  depositAmount?: number | null;
  depositStatus?: "none" | "due" | "collected" | "refunded" | "forfeited";
  quotedWaitMinutes?: number | null;
  policyAcceptedAt?: string | null;
  lastGuestSmsAt?: string | null;
  lastGuestSmsKind?: string | null;
};

export function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export function normalizeReservationPolicies(
  raw: ReservationPolicySettings | null | undefined
): Required<ReservationPolicySettings> {
  const s = raw || {};
  const depositAmount = Number(s.depositAmount);
  return {
    waitlistSmsEnabled: s.waitlistSmsEnabled !== false,
    waitlistQuoteMinutes:
      s.waitlistQuoteMinutes == null || Number(s.waitlistQuoteMinutes) <= 0
        ? null
        : clampInt(s.waitlistQuoteMinutes, 5, 180, 25),
    depositEnabled: s.depositEnabled === true,
    depositAmount:
      Number.isFinite(depositAmount) && depositAmount > 0
        ? Math.min(500, Math.round(depositAmount * 100) / 100)
        : null,
    depositType: s.depositType === "percent" ? "percent" : "fixed",
    cancelHoursBefore:
      s.cancelHoursBefore == null || Number(s.cancelHoursBefore) < 0
        ? 24
        : clampInt(s.cancelHoursBefore, 0, 168, 24),
    googleReservePublish: s.googleReservePublish !== false,
  };
}

export function quoteWaitMinutes(opts: {
  position: number;
  quoteMinutes?: number | null;
  seatingDurationMinutes?: number;
  openTables?: number;
}): number {
  if (opts.quoteMinutes && opts.quoteMinutes > 0) return Math.round(opts.quoteMinutes);
  const duration = Math.max(30, Number(opts.seatingDurationMinutes) || 90);
  const tables = Math.max(1, Number(opts.openTables) || 1);
  const pos = Math.max(0, Number(opts.position) || 0);
  return Math.min(180, Math.max(5, Math.round(((pos + 1) * duration) / tables)));
}

export function depositDueAmount(
  policies: ReturnType<typeof normalizeReservationPolicies>,
  partySize: number
): number | null {
  if (!policies.depositEnabled || !policies.depositAmount) return null;
  if (policies.depositType === "percent") {
    return Math.round(policies.depositAmount * Math.max(1, partySize) * 100) / 100;
  }
  return policies.depositAmount;
}

/** Free cancel when the slot is still farther away than the policy window. */
export function canCancelWithoutForfeit(
  reservedAt: Date | string,
  cancelHoursBefore: number | null | undefined,
  now = new Date()
): boolean {
  const hours = cancelHoursBefore == null ? 24 : Number(cancelHoursBefore);
  const start = reservedAt instanceof Date ? reservedAt : new Date(reservedAt);
  if (Number.isNaN(start.getTime())) return true;
  return start.getTime() - now.getTime() >= hours * 3600_000;
}

export function nextDepositStatusOnCancel(
  current: ReservationExtras["depositStatus"] | null | undefined,
  reservedAt: Date | string,
  cancelHoursBefore: number | null | undefined
): ReservationExtras["depositStatus"] {
  if (current !== "due" && current !== "collected") return current || "none";
  if (canCancelWithoutForfeit(reservedAt, cancelHoursBefore)) {
    return current === "collected" ? "refunded" : "none";
  }
  return current === "collected" ? "forfeited" : "none";
}

export function parseReservationExtras(raw: unknown): ReservationExtras {
  const s = raw && typeof raw === "object" ? (raw as ReservationExtras) : {};
  const status = s.depositStatus;
  return {
    depositAmount:
      s.depositAmount == null || !Number.isFinite(Number(s.depositAmount))
        ? null
        : Math.round(Number(s.depositAmount) * 100) / 100,
    depositStatus:
      status === "due" ||
      status === "collected" ||
      status === "refunded" ||
      status === "forfeited"
        ? status
        : "none",
    quotedWaitMinutes:
      s.quotedWaitMinutes == null || Number(s.quotedWaitMinutes) <= 0
        ? null
        : Math.round(Number(s.quotedWaitMinutes)),
    policyAcceptedAt: s.policyAcceptedAt ? String(s.policyAcceptedAt) : null,
    lastGuestSmsAt: s.lastGuestSmsAt ? String(s.lastGuestSmsAt) : null,
    lastGuestSmsKind: s.lastGuestSmsKind ? String(s.lastGuestSmsKind).slice(0, 40) : null,
  };
}
