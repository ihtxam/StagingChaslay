"use strict";
/** Membership tier / plan definitions stored in merchant gift_card_settings.membershipPlans */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MEMBERSHIP_PLANS = void 0;
exports.normalizeMembershipPlan = normalizeMembershipPlan;
exports.normalizeMembershipPlans = normalizeMembershipPlans;
exports.findMembershipPlan = findMembershipPlan;
exports.applyStampProgress = applyStampProgress;
exports.DEFAULT_MEMBERSHIP_PLANS = [
    {
        id: "student-10",
        label: "Student",
        type: "discount",
        discountPercent: 10,
        active: true,
    },
    {
        id: "vip-20",
        label: "VIP",
        type: "discount",
        discountPercent: 20,
        active: true,
    },
    {
        id: "coffee-club",
        label: "Coffee Club",
        type: "stamp_card",
        stampsRequired: 6,
        active: true,
    },
];
function slugId(label) {
    const base = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return base || `plan-${Date.now()}`;
}
function normalizeMembershipPlan(raw, index) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return null;
    const src = raw;
    const type = src.type === "stamp_card" ? "stamp_card" : "discount";
    const label = String(src.label || "").trim();
    if (!label)
        return null;
    const id = String(src.id || slugId(label)).trim() || slugId(`${label}-${index}`);
    const discountPercent = type === "discount" ? Math.min(100, Math.max(0, Number(src.discountPercent) || 0)) : undefined;
    const stampsRequired = type === "stamp_card"
        ? Math.max(1, Math.floor(Number(src.stampsRequired) || 6))
        : undefined;
    const sellPriceRaw = src.sellPrice != null ? Number(src.sellPrice) : undefined;
    const sellPrice = sellPriceRaw != null && Number.isFinite(sellPriceRaw) && sellPriceRaw >= 0
        ? Math.round(sellPriceRaw * 100) / 100
        : undefined;
    return {
        id,
        label,
        type,
        discountPercent,
        stampsRequired,
        rewardProductId: src.rewardProductId ? String(src.rewardProductId) : null,
        sellPrice,
        active: src.active !== false,
    };
}
function normalizeMembershipPlans(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < raw.length; i++) {
        const plan = normalizeMembershipPlan(raw[i], i);
        if (!plan || seen.has(plan.id))
            continue;
        seen.add(plan.id);
        out.push(plan);
    }
    return out;
}
function findMembershipPlan(plans, planId) {
    if (!planId)
        return null;
    return plans.find((p) => p.id === planId && p.active) || null;
}
/** After a qualifying sale, compute new stamp count and whether reward is earned. */
function applyStampProgress(plan, currentStamps, increment = 1) {
    const required = Math.max(1, plan.stampsRequired || 6);
    let next = Math.max(0, currentStamps) + Math.max(1, increment);
    let rewardEarned = false;
    if (next >= required) {
        rewardEarned = true;
        next = 0;
    }
    return { stampCount: next, rewardEarned };
}
//# sourceMappingURL=membership-plans.js.map