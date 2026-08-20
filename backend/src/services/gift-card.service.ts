import { getDb, schema } from "@/db";
import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import {
  buildGiftCardRedeemQrPayload,
  buildGiftCardRedeemUrl,
  ecardLookupCandidates,
  generateEcardCode,
  normalizeScannedPayload,
} from "@/lib/gift-card-code";
import {
  normalizeGiftCardSettings,
  validateGiftAmount,
  type GiftCardSettings,
} from "@/lib/gift-card-settings";
import {
  applyStampProgress,
  findMembershipPlan,
  type MembershipPlan,
} from "@/lib/membership-plans";
import { CustomerService } from "@/services/customer.service";
import { EmailService } from "@/services/email.service";

function money(n: number | string | null | undefined): number {
  const v = Number(n || 0);
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function cleanOptional(value?: string | null) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

/** Normalize RFID UIDs so tap / manual / issue all match (strip separators, uppercase). */
export function normalizeRfidUid(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/[\s:_\-]+/g, "")
    .toUpperCase();
}

function assertActive(card: { status: string; expiresAt?: Date | null }) {
  if (card.status === "suspended") throw new Error("Card is blocked");
  if (card.status === "expired") throw new Error("Card is expired");
  if (card.expiresAt && card.expiresAt.getTime() < Date.now()) {
    throw new Error("Card is expired");
  }
  if (card.status !== "active") throw new Error("Card is not active");
}

/** Reject blocked/inactive cards at RFID lookup (POS scan). */
function assertLookupAllowed(card: { status: string; expiresAt?: Date | null }) {
  if (card.status === "suspended") throw new Error("Card is blocked");
  if (card.status === "expired") throw new Error("Card is expired");
  if (card.expiresAt && card.expiresAt.getTime() < Date.now()) {
    throw new Error("Card is expired");
  }
  if (card.status !== "active") throw new Error("Card is not active");
}

const PURCHASE_TX_TYPES = [
  "redeem",
  "points_earn",
  "points_redeem",
  "stamp_earn",
  "stamp_reward",
] as const;

async function assertOpenShiftForSell(merchantId: string) {
  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
  });
  if (!merchant?.shiftsEnabled) return;
  const { PosShiftService } = await import("@/services/pos-shift.service");
  const open = await PosShiftService.getOpenShift(merchantId);
  if (!open) {
    throw new Error("Start a cash shift before selling gift cards");
  }
}

export class GiftCardService {
  static async getSettings(merchantId: string): Promise<GiftCardSettings> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");
    return normalizeGiftCardSettings(merchant.giftCardSettings);
  }

  static async updateSettings(
    merchantId: string,
    patch: Partial<GiftCardSettings>
  ): Promise<GiftCardSettings> {
    const db = getDb();
    const current = await this.getSettings(merchantId);
    const next = normalizeGiftCardSettings({ ...current, ...patch });
    await db
      .update(schema.merchants)
      .set({ giftCardSettings: next, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return next;
  }

  static resolveMembershipPlan(
    settings: GiftCardSettings,
    planId: string | null | undefined
  ): MembershipPlan | null {
    return findMembershipPlan(settings.membershipPlans || [], planId);
  }

  /** Enrich card JSON with resolved membership plan for POS clients. */
  static enrichCard(card: Record<string, unknown>, settings: GiftCardSettings) {
    const planId = card.membershipPlanId as string | null | undefined;
    const plan = this.resolveMembershipPlan(settings, planId);
    return {
      ...card,
      membershipPlan: plan,
      stampCount: card.stampCount ?? 0,
      cardKind: card.membershipEnabled ? "membership" : "gift",
    };
  }

  static async listCards(
    merchantId: string,
    opts: { page?: number; limit?: number; status?: string; q?: string } = {}
  ) {
    const db = getDb();
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 50));
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.giftCards.merchantId, merchantId)];
    if (opts.status) {
      conditions.push(eq(schema.giftCards.status, opts.status));
    }

    const cards = await db.query.giftCards.findMany({
      where: and(...conditions),
      with: { customer: true },
      orderBy: desc(schema.giftCards.issuedAt),
      limit,
      offset,
    });

    const q = (opts.q || "").trim().toLowerCase();
    const filtered = q
      ? cards.filter((c) => {
          const hay = [
            c.cardNumber,
            c.ecardCode,
            c.holderName,
            c.holderEmail,
            c.holderPhone,
            c.customer?.firstName,
            c.customer?.lastName,
            c.customer?.email,
            c.customer?.phone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        })
      : cards;

    const settings = await this.getSettings(merchantId);
    const enriched = filtered.map((c) =>
      this.enrichCard(c as unknown as Record<string, unknown>, settings)
    );
    return { cards: enriched, page, limit };
  }

  static async getById(merchantId: string, cardId: string) {
    const db = getDb();
    const card = await db.query.giftCards.findFirst({
      where: and(
        eq(schema.giftCards.id, cardId),
        eq(schema.giftCards.merchantId, merchantId)
      ),
      with: { customer: true },
    });
    if (!card) throw new Error("Card not found");
    return card;
  }

  static async lookup(
    merchantId: string,
    code: string,
    mediaType?: "physical" | "e_card"
  ) {
    const db = getDb();
    const parsed = normalizeScannedPayload(code);
    const trimmed = parsed || String(code || "").trim();
    if (!trimmed) throw new Error("Card number is required");
    const normalized = normalizeRfidUid(trimmed);
    const ecardKeys = ecardLookupCandidates(code);
    const candidates = [
      ...new Set([
        trimmed,
        normalized,
        trimmed.toUpperCase(),
        trimmed.toLowerCase(),
        buildGiftCardRedeemQrPayload(trimmed),
        ...ecardKeys,
        ...ecardKeys.map((k) => normalizeRfidUid(k)).filter(Boolean),
      ]),
    ].filter(Boolean);

    let card = null as Awaited<ReturnType<typeof db.query.giftCards.findFirst>>;

    const tryPhysical = !mediaType || mediaType === "physical";
    const tryEcard = !mediaType || mediaType === "e_card";

    if (tryPhysical) {
      for (const candidate of candidates) {
        card = await db.query.giftCards.findFirst({
          where: and(
            eq(schema.giftCards.merchantId, merchantId),
            eq(schema.giftCards.cardNumber, candidate)
          ),
          with: { customer: true },
        });
        if (card) break;
      }

      // Case-insensitive / separator-insensitive match for older rows
      if (!card && normalized) {
        const rows = await db
          .select()
          .from(schema.giftCards)
          .where(eq(schema.giftCards.merchantId, merchantId))
          .limit(500);
        const match = rows.find((r) => normalizeRfidUid(r.cardNumber) === normalized);
        if (match) {
          card = await db.query.giftCards.findFirst({
            where: and(
              eq(schema.giftCards.merchantId, merchantId),
              eq(schema.giftCards.id, match.id)
            ),
            with: { customer: true },
          });
        }
      }
    }

    if (!card && tryEcard) {
      for (const candidate of candidates) {
        card = await db.query.giftCards.findFirst({
          where: and(
            eq(schema.giftCards.merchantId, merchantId),
            or(
              eq(schema.giftCards.ecardCode, candidate),
              eq(schema.giftCards.cardNumber, candidate)
            )
          ),
          with: { customer: true },
        });
        if (card) break;
      }
    }

    if (!card) throw new Error("Card not found");
    assertLookupAllowed(card);
    const settings = await this.getSettings(merchantId);
    return this.enrichCard(card as unknown as Record<string, unknown>, settings);
  }

  static async createCard(
    merchantId: string,
    input: {
      cardNumber?: string;
      cardMediaType?: "physical" | "e_card";
      initialBalance?: number;
      membershipEnabled?: boolean;
      membershipPlanId?: string;
      holderName?: string;
      holderEmail?: string;
      holderPhone?: string;
      ecardEmail?: string;
      customerId?: string;
    }
  ) {
    const db = getDb();
    const settings = await this.getSettings(merchantId);
    const mediaType = input.cardMediaType === "e_card" ? "e_card" : "physical";

    let cardNumber = String(input.cardNumber || "").trim();
    let ecardCode: string | null = null;

    if (mediaType === "physical") {
      if (!cardNumber) throw new Error("RFID card number is required");
      cardNumber = normalizeRfidUid(cardNumber);
      if (!cardNumber) throw new Error("RFID card number is required");
    } else {
      ecardCode = generateEcardCode();
      if (!cardNumber) cardNumber = ecardCode;
    }

    const existing = await db.query.giftCards.findFirst({
      where: and(
        eq(schema.giftCards.merchantId, merchantId),
        eq(schema.giftCards.cardNumber, cardNumber)
      ),
    });
    if (existing) throw new Error("A card with this number already exists");

    let initial = 0;
    if (input.initialBalance != null && Number(input.initialBalance) > 0) {
      const check = validateGiftAmount(Number(input.initialBalance), settings);
      if (!check.ok) throw new Error(check.error);
      initial = check.amount;
    }

    const membershipEnabled = !!input.membershipEnabled || !!input.customerId || !!input.membershipPlanId;
    if (input.membershipPlanId) {
      const plan = this.resolveMembershipPlan(settings, input.membershipPlanId);
      if (!plan) throw new Error("Membership plan not found");
    }
    const rows = await db
      .insert(schema.giftCards)
      .values({
        merchantId,
        cardNumber,
        cardMediaType: mediaType,
        balance: initial.toFixed(2),
        status: "active",
        membershipEnabled,
        membershipPlanId: input.membershipPlanId || null,
        stampCount: 0,
        pointsBalance: 0,
        customerId: input.customerId || null,
        holderName: input.holderName?.trim() || null,
        holderEmail: input.holderEmail?.trim() || null,
        holderPhone: input.holderPhone?.trim() || null,
        ecardEmail: input.ecardEmail?.trim() || null,
        ecardCode,
        issuedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const card = rows[0]!;
    if (initial > 0) {
      await db.insert(schema.giftCardTransactions).values({
        merchantId,
        cardId: card.id,
        transactionType: "sell",
        amount: initial.toFixed(2),
        balanceAfter: initial.toFixed(2),
        description: "Initial load on card create",
      });
    }
    if (membershipEnabled) {
      await db.insert(schema.giftCardTransactions).values({
        merchantId,
        cardId: card.id,
        transactionType: "membership_issue",
        description: "Membership linked on create",
      });
    }
    return card;
  }

  static async credit(
    merchantId: string,
    opts: {
      cardId?: string;
      cardNumber?: string;
      cardMediaType?: "physical" | "e_card";
      ecardEmail?: string;
      holderName?: string;
      amount: number;
      type: "sell" | "reload";
      orderId?: string;
      createIfMissing?: boolean;
      skipShiftCheck?: boolean;
    }
  ) {
    const db = getDb();
    const settings = await this.getSettings(merchantId);
    if (!settings.enabled) throw new Error("Gift cards are disabled");
    if (opts.type === "sell") {
      if (!opts.skipShiftCheck) {
        await assertOpenShiftForSell(merchantId);
      }
    }
    if (opts.type === "reload" && !settings.reloadEnabled) {
      throw new Error("Card reload is disabled");
    }

    const check = validateGiftAmount(opts.amount, settings);
    if (!check.ok) throw new Error(check.error);
    const amount = check.amount;

    let card =
      opts.cardId != null
        ? await this.getById(merchantId, opts.cardId)
        : null;

    if (!card && opts.cardNumber) {
      try {
        card = await this.lookup(merchantId, opts.cardNumber, opts.cardMediaType);
      } catch {
        card = null;
      }
    }

    if (!card) {
      const mediaType = opts.cardMediaType === "e_card" ? "e_card" : "physical";
      const canCreate =
        opts.type === "sell" &&
        opts.createIfMissing !== false &&
        (opts.cardNumber || mediaType === "e_card");
      if (canCreate) {
        const created = await this.createCard(merchantId, {
          cardNumber: opts.cardNumber,
          cardMediaType: mediaType,
          initialBalance: 0,
          ecardEmail: opts.ecardEmail,
          holderName: opts.holderName,
        });
        card = await this.getById(merchantId, created.id);
      } else {
        throw new Error("Card not found");
      }
    }

    const activeCard = card!;
    assertActive(activeCard);

    const newBalance = money(activeCard.balance) + amount;
    if (newBalance > settings.maxAmount) {
      throw new Error(
        `Balance cannot exceed CHF ${settings.maxAmount.toFixed(2)}`
      );
    }

    const updated = await db
      .update(schema.giftCards)
      .set({
        balance: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, activeCard.id),
          eq(schema.giftCards.merchantId, merchantId)
        )
      )
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId: activeCard.id,
      transactionType: opts.type,
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      orderId: opts.orderId || null,
      description:
        opts.type === "sell"
          ? `Sold / loaded CHF ${amount.toFixed(2)}`
          : `Reloaded CHF ${amount.toFixed(2)}`,
    });

    return updated[0]!;
  }

  /**
   * Redeem stored value. Partial redeem allowed when allowPartial=true
   * (returns amountRedeemed which may be less than requested).
   */
  static async redeem(
    merchantId: string,
    opts: {
      cardId?: string;
      cardNumber?: string;
      ecardCode?: string;
      amount: number;
      orderId?: string;
      allowPartial?: boolean;
    }
  ) {
    const db = getDb();
    const settings = await this.getSettings(merchantId);
    if (!settings.enabled) throw new Error("Gift cards are disabled");

    const requested = money(opts.amount);
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new Error("Valid amount is required");
    }

    let card: Awaited<ReturnType<typeof this.getById>>;
    if (opts.cardId) {
      card = await this.getById(merchantId, opts.cardId);
    } else {
      const code = opts.cardNumber || opts.ecardCode;
      if (!code) throw new Error("Card number is required");
      card = await this.lookup(merchantId, code);
    }

    assertActive(card);

    const balance = money(card.balance);
    if (balance <= 0) throw new Error("Card has no balance");

    let amount = requested;
    if (balance < requested) {
      if (!opts.allowPartial) throw new Error("Insufficient balance");
      amount = balance;
    }

    const newBalance = money(balance - amount);
    const updated = await db
      .update(schema.giftCards)
      .set({
        balance: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, card.id),
          eq(schema.giftCards.merchantId, merchantId),
          sql`${schema.giftCards.balance}::numeric >= ${amount}`
        )
      )
      .returning();

    if (!updated[0]) throw new Error("Insufficient balance");

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId: card.id,
      transactionType: "redeem",
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      orderId: opts.orderId || null,
      description: `Redeemed CHF ${amount.toFixed(2)}`,
    });

    return {
      card: updated[0],
      amountRedeemed: amount,
      amountRequested: requested,
      remainingBalance: newBalance,
      shortfall: money(Math.max(0, requested - amount)),
    };
  }

  static async attachMembership(
    merchantId: string,
    cardId: string,
    input: {
      name?: string;
      email?: string;
      phone?: string;
      customerId?: string;
    }
  ) {
    const db = getDb();
    const card = await this.getById(merchantId, cardId);
    assertActive(card);

    let customerId = input.customerId || card.customerId || null;
    const name = String(input.name || card.holderName || "").trim();
    const email = String(input.email || card.holderEmail || "").trim();
    const phone = String(input.phone || card.holderPhone || "").trim();

    if (!customerId) {
      if (!name && !email && !phone) {
        throw new Error("Name, email, or phone is required for membership");
      }
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0] || "Member";
      const last = parts.slice(1).join(" ") || "";
      const customer = await CustomerService.createCustomer(
        merchantId,
        email || undefined,
        phone || undefined,
        first,
        last
      );
      customerId = customer.id;
    }

    const updated = await db
      .update(schema.giftCards)
      .set({
        membershipEnabled: true,
        customerId,
        holderName: name || null,
        holderEmail: email || null,
        holderPhone: phone || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, cardId),
          eq(schema.giftCards.merchantId, merchantId)
        )
      )
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId,
      transactionType: "membership_issue",
      description: `Membership attached${name ? `: ${name}` : ""}`,
    });

    return updated[0]!;
  }

  /** Sell / register a membership card: RFID + customer + tier plan. */
  static async sellMembership(
    merchantId: string,
    input: {
      cardNumber: string;
      planId: string;
      name: string;
      email?: string;
      phone?: string;
      orderId?: string;
    }
  ) {
    const settings = await this.getSettings(merchantId);
    if (!settings.membershipEnabled) throw new Error("Membership is disabled");
    const plan = this.resolveMembershipPlan(settings, input.planId);
    if (!plan) throw new Error("Membership plan not found");

    const name = String(input.name || "").trim();
    const email = String(input.email || "").trim();
    const phone = String(input.phone || "").trim();
    if (!name) throw new Error("Member name is required");
    if (!email && !phone) throw new Error("Email or phone is required");

    const cardNumber = normalizeRfidUid(input.cardNumber);
    if (!cardNumber) throw new Error("RFID card number is required");

    const db = getDb();
    const existing = await db.query.giftCards.findFirst({
      where: and(
        eq(schema.giftCards.merchantId, merchantId),
        eq(schema.giftCards.cardNumber, cardNumber)
      ),
    });
    if (existing) throw new Error("A card with this number already exists");

    const parts = name.split(/\s+/).filter(Boolean);
    const customer = await CustomerService.createCustomer(
      merchantId,
      email || undefined,
      phone || undefined,
      parts[0] || "Member",
      parts.slice(1).join(" ") || ""
    );

    const rows = await db
      .insert(schema.giftCards)
      .values({
        merchantId,
        cardNumber,
        cardMediaType: "physical",
        balance: "0",
        status: "active",
        membershipEnabled: true,
        membershipPlanId: plan.id,
        stampCount: 0,
        pointsBalance: 0,
        customerId: customer.id,
        holderName: name,
        holderEmail: email || null,
        holderPhone: phone || null,
        issuedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const card = rows[0]!;
    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId: card.id,
      transactionType: "membership_issue",
      orderId: input.orderId || null,
      description: `Membership sold: ${plan.label}`,
    });

    return this.enrichCard(card as unknown as Record<string, unknown>, settings);
  }

  /** Increment stamp-card progress after a qualifying sale. */
  static async incrementStamp(
    merchantId: string,
    cardId: string,
    orderId?: string,
    increment = 1
  ) {
    const db = getDb();
    const settings = await this.getSettings(merchantId);
    const card = await this.getById(merchantId, cardId);
    if (!card.membershipEnabled || !card.membershipPlanId) {
      throw new Error("Card has no membership plan");
    }
    const plan = this.resolveMembershipPlan(settings, card.membershipPlanId);
    if (!plan || plan.type !== "stamp_card") {
      throw new Error("Card is not on a stamp-card plan");
    }
    assertActive(card);

    const { stampCount, rewardEarned } = applyStampProgress(
      plan,
      card.stampCount || 0,
      increment
    );

    const updated = await db
      .update(schema.giftCards)
      .set({ stampCount, updatedAt: new Date() })
      .where(eq(schema.giftCards.id, cardId))
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId,
      transactionType: rewardEarned ? "stamp_reward" : "stamp_earn",
      orderId: orderId || null,
      description: rewardEarned
        ? `${plan.label}: reward earned (${plan.stampsRequired} stamps)`
        : `${plan.label}: stamp ${stampCount}/${plan.stampsRequired}`,
    });

    return {
      card: this.enrichCard(updated[0]! as unknown as Record<string, unknown>, settings),
      rewardEarned,
      stampCount,
      plan,
    };
  }
  static async refundToCard(
    merchantId: string,
    opts: {
      cardId: string;
      amount: number;
      orderId?: string;
    }
  ) {
    const db = getDb();
    const settings = await this.getSettings(merchantId);
    if (!settings.enabled) throw new Error("Gift cards are disabled");

    const amount = money(opts.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Valid amount is required");
    }

    const card = await this.getById(merchantId, opts.cardId);
    assertActive(card);

    const newBalance = money(card.balance) + amount;
    if (newBalance > settings.maxAmount) {
      throw new Error(
        `Balance cannot exceed CHF ${settings.maxAmount.toFixed(2)}`
      );
    }

    const updated = await db
      .update(schema.giftCards)
      .set({
        balance: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, opts.cardId),
          eq(schema.giftCards.merchantId, merchantId)
        )
      )
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId: opts.cardId,
      transactionType: "adjust",
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      orderId: opts.orderId || null,
      description: `Refund restored CHF ${amount.toFixed(2)}`,
    });

    return updated[0]!;
  }

  static async addPoints(merchantId: string, cardId: string, points: number, orderId?: string) {
    const db = getDb();
    const card = await this.getById(merchantId, cardId);
    if (!card.membershipEnabled || !card.customerId) {
      throw new Error("Card has no membership");
    }
    assertActive(card);
    const pts = Math.floor(Number(points));
    if (!Number.isFinite(pts) || pts <= 0) throw new Error("Valid points required");

    const newPoints = (card.pointsBalance || 0) + pts;
    const updated = await db
      .update(schema.giftCards)
      .set({ pointsBalance: newPoints, updatedAt: new Date() })
      .where(eq(schema.giftCards.id, cardId))
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId,
      transactionType: "points_earn",
      points: pts,
      pointsAfter: newPoints,
      orderId: orderId || null,
      description: `Earned ${pts} points`,
    });
    return updated[0]!;
  }

  static async redeemPoints(merchantId: string, cardId: string, points: number, orderId?: string) {
    const db = getDb();
    const card = await this.getById(merchantId, cardId);
    if (!card.membershipEnabled || !card.customerId) {
      throw new Error("Card has no membership");
    }
    assertActive(card);
    const pts = Math.floor(Number(points));
    if (!Number.isFinite(pts) || pts <= 0) throw new Error("Valid points required");
    const balance = card.pointsBalance || 0;
    if (pts > balance) throw new Error("Insufficient points");

    const newPoints = balance - pts;
    const updated = await db
      .update(schema.giftCards)
      .set({ pointsBalance: newPoints, updatedAt: new Date() })
      .where(eq(schema.giftCards.id, cardId))
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId,
      transactionType: "points_redeem",
      points: -pts,
      pointsAfter: newPoints,
      orderId: orderId || null,
      description: `Redeemed ${pts} points`,
    });
    return updated[0]!;
  }

  static async suspend(merchantId: string, cardId: string, reason?: string) {
    const db = getDb();
    const rows = await db
      .update(schema.giftCards)
      .set({
        status: "suspended",
        suspendedReason: reason || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, cardId),
          eq(schema.giftCards.merchantId, merchantId)
        )
      )
      .returning();
    if (!rows[0]) throw new Error("Card not found");
    return rows[0];
  }

  static async reactivate(merchantId: string, cardId: string) {
    const db = getDb();
    const rows = await db
      .update(schema.giftCards)
      .set({
        status: "active",
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.giftCards.id, cardId),
          eq(schema.giftCards.merchantId, merchantId)
        )
      )
      .returning();
    if (!rows[0]) throw new Error("Card not found");
    return rows[0];
  }

  /** Email e-gift card receipt with redeem code + balance to recipient. */
  static async sendEcardReceiptEmail(
    merchantId: string,
    opts: {
      to: string;
      code: string;
      balance: number;
      holderName?: string;
      orderId?: string;
    }
  ) {
    const to = String(opts.to || "").trim();
    if (!to.includes("@")) throw new Error("Valid recipient email is required");

    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { name: true, slug: true },
    });
    const shopName = merchant?.name || "Shop";
    const code = buildGiftCardRedeemQrPayload(opts.code);
    if (!code) throw new Error("Gift card code is required");
    const balance = money(opts.balance);
    const redeemUrl = buildGiftCardRedeemUrl(code);
    const shopSlug = merchant?.slug;
    const shopGiftUrl =
      shopSlug && process.env.DOMAIN
        ? `https://shop.${process.env.DOMAIN.replace(/^https?:\/\//, '')}/${shopSlug}/gift/${encodeURIComponent(code)}`
        : redeemUrl;
    const holder = opts.holderName?.trim();

    const subject = `${shopName} · Gift card CHF ${balance.toFixed(2)}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;">
        <h2 style="margin:0 0 8px;">${shopName}</h2>
        <p style="margin:0 0 16px;color:#57534e;">You received a digital gift card${holder ? ` for ${holder.replace(/</g, "&lt;")}` : ""}.</p>
        <p style="font-size:28px;font-weight:700;margin:8px 0;color:#0f766e;">CHF ${balance.toFixed(2)}</p>
        <p style="margin:16px 0 8px;font-weight:600;">Your gift card code</p>
        <p style="font-family:ui-monospace,monospace;font-size:20px;letter-spacing:1px;background:#f5f5f4;padding:12px 16px;border-radius:8px;">${code.replace(/</g, "&lt;")}</p>
        <p style="margin:16px 0 8px;color:#57534e;">Present this code or QR at checkout to redeem.</p>
        <p><a href="${shopGiftUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View gift card</a></p>
        <p style="color:#666;font-size:12px;word-break:break-all;">${shopGiftUrl}</p>
      </div>
    `;
    const text =
      `${shopName}\nDigital gift card: CHF ${balance.toFixed(2)}\n` +
      (holder ? `For: ${holder}\n` : "") +
      `Code: ${code}\n` +
      `Redeem at checkout by scanning or entering the code.\n` +
      `${shopGiftUrl}\n`;

    await EmailService.send({
      to,
      subject,
      html,
      text,
      merchantId,
    });

    return { sent: true, to, code };
  }

  static async updateCard(
    merchantId: string,
    cardId: string,
    patch: {
      holderName?: string;
      holderEmail?: string;
      holderPhone?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    }
  ) {
    const db = getDb();
    const card = await this.getById(merchantId, cardId);

    const holderName =
      patch.holderName !== undefined ? cleanOptional(patch.holderName) : card.holderName;
    const holderEmail =
      patch.holderEmail !== undefined ? cleanOptional(patch.holderEmail) : card.holderEmail;
    let holderPhone =
      patch.holderPhone !== undefined ? cleanOptional(patch.holderPhone) : card.holderPhone;
    if (holderPhone) {
      const digits = holderPhone.replace(/\D/g, "");
      if (!/^\d{1,15}$/.test(digits)) throw new Error("Phone number must be digits only (max 15)");
      holderPhone = digits;
    }

    const updated = await db
      .update(schema.giftCards)
      .set({
        holderName: holderName ?? null,
        holderEmail: holderEmail ?? null,
        holderPhone: holderPhone ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.giftCards.id, cardId), eq(schema.giftCards.merchantId, merchantId))
      )
      .returning();

    if (card.customerId) {
      const customerPatch: Record<string, string | null> = {};
      if (patch.firstName !== undefined) customerPatch.firstName = cleanOptional(patch.firstName);
      if (patch.lastName !== undefined) customerPatch.lastName = cleanOptional(patch.lastName);
      if (patch.email !== undefined) customerPatch.email = cleanOptional(patch.email);
      if (patch.phone !== undefined) {
        const tel = cleanOptional(patch.phone);
        if (tel) {
          const digits = tel.replace(/\D/g, "");
          if (!/^\d{1,15}$/.test(digits)) {
            throw new Error("Phone number must be digits only (max 15)");
          }
          customerPatch.phone = digits;
        } else {
          customerPatch.phone = null;
        }
      }
      if (Object.keys(customerPatch).length > 0) {
        await CustomerService.updateCustomer(merchantId, card.customerId, customerPatch);
      }
    }

    return updated[0]!;
  }

  /** Merchant admin top-up — balance or stamp progress with audit log. */
  static async adminTopUp(
    merchantId: string,
    cardId: string,
    input: {
      type: "balance" | "stamps";
      amount?: number;
      stamps?: number;
      note?: string;
    }
  ) {
    const db = getDb();
    const card = await this.getById(merchantId, cardId);
    assertActive(card);
    const note = String(input.note || "").trim();

    if (input.type === "balance") {
      const amount = money(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Valid amount is required");
      }
      const settings = await this.getSettings(merchantId);
      const newBalance = money(card.balance) + amount;
      if (newBalance > settings.maxAmount) {
        throw new Error(`Balance cannot exceed CHF ${settings.maxAmount.toFixed(2)}`);
      }
      const updated = await db
        .update(schema.giftCards)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(schema.giftCards.id, cardId))
        .returning();
      await db.insert(schema.giftCardTransactions).values({
        merchantId,
        cardId,
        transactionType: "adjust",
        amount: amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        description: note
          ? `Admin top-up CHF ${amount.toFixed(2)}: ${note}`
          : `Admin top-up CHF ${amount.toFixed(2)}`,
      });
      return updated[0]!;
    }

    if (!card.membershipEnabled || !card.membershipPlanId) {
      throw new Error("Card has no membership plan for stamp top-up");
    }
    const settings = await this.getSettings(merchantId);
    const plan = this.resolveMembershipPlan(settings, card.membershipPlanId);
    if (!plan || plan.type !== "stamp_card") {
      throw new Error("Card is not on a stamp-card plan");
    }
    const add = Math.floor(Number(input.stamps) || 0);
    if (!Number.isFinite(add) || add <= 0) throw new Error("Valid stamp count is required");

    const required = Math.max(1, plan.stampsRequired || 6);
    let stampCount = Math.max(0, (card.stampCount || 0) + add);
    let rewardEarned = false;
    while (stampCount >= required) {
      rewardEarned = true;
      stampCount -= required;
    }

    const updated = await db
      .update(schema.giftCards)
      .set({ stampCount, updatedAt: new Date() })
      .where(eq(schema.giftCards.id, cardId))
      .returning();

    await db.insert(schema.giftCardTransactions).values({
      merchantId,
      cardId,
      transactionType: rewardEarned ? "stamp_reward" : "stamp_adjust",
      description: note
        ? `Admin stamp top-up +${add}${rewardEarned ? " (reward earned)" : ""}: ${note}`
        : `Admin stamp top-up +${add}${rewardEarned ? " (reward earned)" : ""}`,
    });

    return {
      card: this.enrichCard(updated[0]! as unknown as Record<string, unknown>, settings),
      stampCount,
      rewardEarned,
    };
  }

  /** Aggregate purchase history for a member card (customer + gift-card order links). */
  static async getMemberSpending(
    merchantId: string,
    cardId: string,
    opts: { page?: number; limit?: number } = {}
  ) {
    const db = getDb();
    const card = await this.getById(merchantId, cardId);
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 20));
    const offset = (page - 1) * limit;

    const orderIdSet = new Set<string>();

    const txRows = await db
      .select({ orderId: schema.giftCardTransactions.orderId })
      .from(schema.giftCardTransactions)
      .where(
        and(
          eq(schema.giftCardTransactions.merchantId, merchantId),
          eq(schema.giftCardTransactions.cardId, cardId),
          isNotNull(schema.giftCardTransactions.orderId),
          inArray(schema.giftCardTransactions.transactionType, [...PURCHASE_TX_TYPES])
        )
      );
    for (const row of txRows) {
      if (row.orderId) orderIdSet.add(row.orderId);
    }

    let customerOrders: Array<{ id: string; total: string; createdAt: Date; orderNumber: string; status: string; paymentStatus: string | null }> = [];
    if (card.customerId) {
      customerOrders = await db
        .select({
          id: schema.orders.id,
          total: schema.orders.total,
          createdAt: schema.orders.createdAt,
          orderNumber: schema.orders.orderNumber,
          status: schema.orders.status,
          paymentStatus: schema.orders.paymentStatus,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.merchantId, merchantId),
            eq(schema.orders.customerId, card.customerId)
          )
        );
      for (const o of customerOrders) orderIdSet.add(o.id);
    }

    const allOrderIds = [...orderIdSet];
    if (allOrderIds.length === 0) {
      return {
        statistics: { totalSpent: 0, orderCount: 0, averageOrderValue: 0 },
        orders: [],
        page,
        limit,
        total: 0,
      };
    }

    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        inArray(schema.orders.id, allOrderIds)
      ),
      orderBy: desc(schema.orders.createdAt),
      limit,
      offset,
    });

    const completed = orders.filter(
      (o) => o.status !== "cancelled" && o.paymentStatus !== "failed"
    );
    const allForStats = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        inArray(schema.orders.id, allOrderIds)
      ),
    });
    const statsOrders = allForStats.filter(
      (o) => o.status !== "cancelled" && o.paymentStatus !== "failed"
    );
    const totalSpent = statsOrders.reduce((sum, o) => sum + money(o.total), 0);
    const orderCount = statsOrders.length;

    return {
      statistics: {
        totalSpent,
        orderCount,
        averageOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
      },
      orders: completed,
      page,
      limit,
      total: statsOrders.length,
    };
  }

  static async getTransactions(
    merchantId: string,
    cardId: string,
    page = 1,
    limit = 30
  ) {
    const db = getDb();
    await this.getById(merchantId, cardId);
    const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    return db.query.giftCardTransactions.findMany({
      where: and(
        eq(schema.giftCardTransactions.merchantId, merchantId),
        eq(schema.giftCardTransactions.cardId, cardId)
      ),
      orderBy: desc(schema.giftCardTransactions.createdAt),
      limit,
      offset,
    });
  }
}
