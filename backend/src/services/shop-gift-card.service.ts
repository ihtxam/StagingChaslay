import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { roundMoney2 } from "@/lib/money";
import {
  normalizeGiftCardSettings,
  validateGiftAmount,
  type GiftCardSettings,
} from "@/lib/gift-card-settings";
import { buildGiftCardRedeemUrl } from "@/lib/gift-card-code";
import { GiftCardService } from "@/services/gift-card.service";
import { AdyenService } from "@/services/adyen.service";

function maskEmail(email: string | null | undefined): string | null {
  const e = String(email || "").trim();
  if (!e.includes("@")) return null;
  const [local, domain] = e.split("@");
  if (!local || !domain) return null;
  const shown = local.length <= 2 ? local[0] || "*" : `${local.slice(0, 2)}***`;
  return `${shown}@${domain}`;
}

export class ShopGiftCardService {
  static settingsFromMerchant(merchant: {
    giftCardSettings?: unknown;
  }): GiftCardSettings {
    return normalizeGiftCardSettings(merchant.giftCardSettings);
  }

  static isOnlineEnabled(settings: GiftCardSettings): boolean {
    return settings.enabled && settings.onlinePurchaseEnabled !== false;
  }

  /** Public shop settings — no auth required */
  static publicSettings(settings: GiftCardSettings) {
    return {
      enabled: this.isOnlineEnabled(settings),
      presetDenominations: settings.presetDenominations,
      minAmount: settings.minAmount,
      maxAmount: settings.maxAmount,
      customAmountEnabled: settings.customAmountEnabled,
    };
  }

  /** Public balance lookup — returns balance + masked holder email */
  static async lookupPublicBalance(merchantId: string, code: string) {
    const settings = await GiftCardService.getSettings(merchantId);
    if (!settings.enabled) throw new Error("Gift cards are not available");

    const card = await GiftCardService.lookup(merchantId, code);
    if (card.status !== "active") throw new Error("Card is not active");

    const balance = roundMoney2(Number(card.balance) || 0);
    const ecode = card.ecardCode || card.cardNumber;
    return {
      balance,
      code: ecode,
      holderName: card.holderName || null,
      holderEmailMasked: maskEmail(card.holderEmail || card.ecardEmail),
      redeemUrl: buildGiftCardRedeemUrl(ecode),
      mediaType: card.cardMediaType,
    };
  }

  static async createOnlinePurchase(
    merchant: {
      id: string;
      slug?: string | null;
      name: string;
      adyenMerchantAccount?: string | null;
      adyenApiKey?: string | null;
      adyenClientId?: string | null;
      giftCardSettings?: unknown;
    },
    slug: string,
    input: {
      amount: number;
      recipientEmail: string;
      recipientName?: string;
      senderName?: string;
      senderEmail?: string;
      message?: string;
      paymentMethod?: "card";
    }
  ) {
    const settings = this.settingsFromMerchant(merchant);
    if (!this.isOnlineEnabled(settings)) {
      throw new Error("Online gift card purchase is not enabled");
    }

    const check = validateGiftAmount(input.amount, settings);
    if (!check.ok) throw new Error(check.error);

    const recipientEmail = String(input.recipientEmail || "").trim().toLowerCase();
    if (!recipientEmail.includes("@")) {
      throw new Error("Valid recipient email is required");
    }

    const db = getDb();
    const [purchase] = await db
      .insert(schema.giftCardPurchases)
      .values({
        merchantId: merchant.id,
        amount: check.amount.toFixed(2),
        recipientEmail,
        recipientName: input.recipientName?.trim() || null,
        senderName: input.senderName?.trim() || null,
        senderEmail: input.senderEmail?.trim().toLowerCase() || null,
        message: input.message?.trim() || null,
        paymentMethod: "card",
        paymentStatus: "awaiting_payment",
      })
      .returning();

    const cardReady = !!(
      merchant.adyenMerchantAccount &&
      merchant.adyenApiKey &&
      merchant.adyenClientId
    );

    let paymentSession: Record<string, unknown> | null = null;
    if (cardReady) {
      try {
        const domain = process.env.DOMAIN || "manupos.webprintmedia.swiss";
        const returnUrl = `https://${domain}/shop/${merchant.slug || slug}/gift-cards/confirm/${purchase.id}?paid=1`;
        const session = await AdyenService.initializePaymentSession(
          merchant.id,
          purchase.id,
          check.amount,
          "CHF",
          returnUrl
        );
        paymentSession = {
          id: session.id,
          sessionData: session.sessionData,
          clientKey: merchant.adyenClientId,
          environment:
            (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live"
              ? "live"
              : "test",
        };
      } catch (e) {
        paymentSession = {
          error: e instanceof Error ? e.message : "Adyen not configured",
          demoConfirmAvailable: true,
        };
      }
    } else {
      paymentSession = {
        error: "Card payments not configured",
        demoConfirmAvailable: true,
      };
    }

    return { purchase, paymentSession, amount: check.amount };
  }

  static async getPurchase(merchantId: string, purchaseId: string) {
    const db = getDb();
    const purchase = await db.query.giftCardPurchases.findFirst({
      where: and(
        eq(schema.giftCardPurchases.id, purchaseId),
        eq(schema.giftCardPurchases.merchantId, merchantId)
      ),
    });
    if (!purchase) throw new Error("Purchase not found");
    return purchase;
  }

  /** Fulfill after Adyen payment — issue e-card and email recipient */
  static async confirmPurchasePayment(
    merchantId: string,
    purchaseId: string,
    pspReference?: string
  ) {
    const db = getDb();
    const purchase = await this.getPurchase(merchantId, purchaseId);

    if (purchase.paymentStatus === "completed" && purchase.cardId) {
      const card = await GiftCardService.getById(merchantId, purchase.cardId);
      return { purchase, card, alreadyFulfilled: true };
    }

    const amount = roundMoney2(Number(purchase.amount));

    const card = await GiftCardService.credit(merchantId, {
      cardMediaType: "e_card",
      ecardEmail: purchase.recipientEmail,
      holderName: purchase.recipientName || purchase.recipientName || undefined,
      amount,
      type: "sell",
      createIfMissing: true,
      skipShiftCheck: true,
    });

    if (purchase.message || purchase.senderName) {
      await db
        .update(schema.giftCards)
        .set({
          holderName: purchase.recipientName || card.holderName,
          updatedAt: new Date(),
        })
        .where(eq(schema.giftCards.id, card.id));
    }

    try {
      await GiftCardService.sendEcardReceiptEmail(merchantId, {
        to: purchase.recipientEmail,
        code: card.ecardCode || card.cardNumber,
        balance: roundMoney2(Number(card.balance)),
        holderName: purchase.recipientName || undefined,
      });
    } catch (err) {
      console.warn("Gift card purchase email failed:", err);
    }

    const [updatedPurchase] = await db
      .update(schema.giftCardPurchases)
      .set({
        paymentStatus: "completed",
        adyenReference: pspReference || purchase.adyenReference,
        cardId: card.id,
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.giftCardPurchases.id, purchase.id))
      .returning();

    return { purchase: updatedPurchase, card, alreadyFulfilled: false };
  }

  /** Redeem gift card at shop checkout — returns discount amount applied */
  static async redeemForOrder(
    merchantId: string,
    code: string,
    orderTotal: number,
    orderId: string
  ) {
    const settings = await GiftCardService.getSettings(merchantId);
    if (!settings.enabled) throw new Error("Gift cards are not enabled");

    const result = await GiftCardService.redeem(merchantId, {
      cardNumber: code,
      amount: orderTotal,
      orderId,
      allowPartial: true,
    });

    return {
      amountRedeemed: roundMoney2(Number(result.amountRedeemed) || 0),
      remainingBalance: roundMoney2(Number(result.remainingBalance) || 0),
      cardId: result.card?.id,
    };
  }
}
