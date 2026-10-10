export const SMS_TIER_KEYS = ["starter", "growth", "pro"] as const;
export type SmsTierKey = (typeof SMS_TIER_KEYS)[number];

export type SmsTier = {
  key: SmsTierKey;
  label: string;
  monthlyAllowance: number;
  suggestedMonthlyChf: number;
};

export const SMS_TIERS: Record<SmsTierKey, SmsTier> = {
  starter: {
    key: "starter",
    label: "Starter",
    monthlyAllowance: 100,
    suggestedMonthlyChf: 19,
  },
  growth: {
    key: "growth",
    label: "Growth",
    monthlyAllowance: 500,
    suggestedMonthlyChf: 49,
  },
  pro: {
    key: "pro",
    label: "Pro",
    monthlyAllowance: 2000,
    suggestedMonthlyChf: 99,
  },
};

export function normalizeSmsTier(value: unknown): SmsTierKey {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  if (key === "growth" || key === "pro" || key === "starter") return key;
  return "starter";
}

export function smsTierAllowance(tier: unknown, override?: number | null): number {
  if (override != null && Number.isFinite(Number(override)) && Number(override) > 0) {
    return Math.floor(Number(override));
  }
  return SMS_TIERS[normalizeSmsTier(tier)].monthlyAllowance;
}

export function smsPeriodYm(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export type SmsQuotaSnapshot = {
  tier: SmsTierKey;
  periodYm: string;
  allowance: number;
  sent: number;
  remaining: number;
  overQuota: boolean;
};

export function remainingSmsCount(sent: number, allowance: number): number {
  const used = Math.max(0, Math.floor(Number(sent) || 0));
  const cap = Math.max(0, Math.floor(Number(allowance) || 0));
  return Math.max(0, cap - used);
}

export function smsQuotaSnapshot(input: {
  tier?: unknown;
  sent?: number;
  allowanceOverride?: number | null;
  at?: Date;
}): SmsQuotaSnapshot {
  const tier = normalizeSmsTier(input.tier);
  const allowance = smsTierAllowance(tier, input.allowanceOverride);
  const sent = Math.max(0, Math.floor(Number(input.sent) || 0));
  const remaining = remainingSmsCount(sent, allowance);
  return {
    tier,
    periodYm: smsPeriodYm(input.at),
    allowance,
    sent,
    remaining,
    overQuota: remaining <= 0,
  };
}

export function canConsumeSms(sent: number, allowance: number, count = 1): boolean {
  return remainingSmsCount(sent, allowance) >= Math.max(1, count);
}
