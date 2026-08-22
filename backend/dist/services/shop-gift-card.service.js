"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopGiftCardService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const money_1 = require("@/lib/money");
const gift_card_settings_1 = require("@/lib/gift-card-settings");
const gift_card_code_1 = require("@/lib/gift-card-code");
const gift_card_service_1 = require("@/services/gift-card.service");
const adyen_service_1 = require("@/services/adyen.service");
function maskEmail(email) {
    const e = String(email || "").trim();
    if (!e.includes("@"))
        return null;
    const [local, domain] = e.split("@");
    if (!local || !domain)
        return null;
    const shown = local.length <= 2 ? local[0] || "*" : `${local.slice(0, 2)}***`;
    return `${shown}@${domain}`;
}
class ShopGiftCardService {
    static settingsFromMerchant(merchant) {
        return (0, gift_card_settings_1.normalizeGiftCardSettings)(merchant.giftCardSettings);
    }
    static isOnlineEnabled(settings) {
        return settings.enabled && settings.onlinePurchaseEnabled !== false;
    }
    /** Public shop settings — no auth required */
    static publicSettings(settings) {
        return {
            enabled: this.isOnlineEnabled(settings),
            presetDenominations: settings.presetDenominations,
            minAmount: settings.minAmount,
            maxAmount: settings.maxAmount,
            customAmountEnabled: settings.customAmountEnabled,
        };
    }
    /** Public balance lookup — returns balance + masked holder email */
    static async lookupPublicBalance(merchantId, code) {
        const settings = await gift_card_service_1.GiftCardService.getSettings(merchantId);
        if (!settings.enabled)
            throw new Error("Gift cards are not available");
        const card = await gift_card_service_1.GiftCardService.lookup(merchantId, code);
        if (card.status !== "active")
            throw new Error("Card is not active");
        const balance = (0, money_1.roundMoney2)(Number(card.balance) || 0);
        const ecode = card.ecardCode || card.cardNumber;
        return {
            balance,
            code: ecode,
            holderName: card.holderName || null,
            holderEmailMasked: maskEmail(card.holderEmail || card.ecardEmail),
            redeemUrl: (0, gift_card_code_1.buildGiftCardRedeemUrl)(ecode),
            mediaType: card.cardMediaType,
        };
    }
    static async createOnlinePurchase(merchant, slug, input) {
        const settings = this.settingsFromMerchant(merchant);
        if (!this.isOnlineEnabled(settings)) {
            throw new Error("Online gift card purchase is not enabled");
        }
        const check = (0, gift_card_settings_1.validateGiftAmount)(input.amount, settings);
        if (!check.ok)
            throw new Error(check.error);
        const recipientEmail = String(input.recipientEmail || "").trim().toLowerCase();
        if (!recipientEmail.includes("@")) {
            throw new Error("Valid recipient email is required");
        }
        const db = (0, db_1.getDb)();
        const [purchase] = await db
            .insert(db_1.schema.giftCardPurchases)
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
        const cardReady = !!(merchant.adyenMerchantAccount &&
            merchant.adyenApiKey &&
            merchant.adyenClientId);
        let paymentSession = null;
        if (cardReady) {
            try {
                const domain = process.env.DOMAIN || "manupos.webprintmedia.swiss";
                const returnUrl = `https://${domain}/shop/${merchant.slug || slug}/gift-cards/confirm/${purchase.id}?paid=1`;
                const session = await adyen_service_1.AdyenService.initializePaymentSession(merchant.id, purchase.id, check.amount, "CHF", returnUrl);
                paymentSession = {
                    id: session.id,
                    sessionData: session.sessionData,
                    clientKey: merchant.adyenClientId,
                    environment: (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live"
                        ? "live"
                        : "test",
                };
            }
            catch (e) {
                paymentSession = {
                    error: e instanceof Error ? e.message : "Adyen not configured",
                    demoConfirmAvailable: true,
                };
            }
        }
        else {
            paymentSession = {
                error: "Card payments not configured",
                demoConfirmAvailable: true,
            };
        }
        return { purchase, paymentSession, amount: check.amount };
    }
    static async getPurchase(merchantId, purchaseId) {
        const db = (0, db_1.getDb)();
        const purchase = await db.query.giftCardPurchases.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.giftCardPurchases.id, purchaseId), (0, drizzle_orm_1.eq)(db_1.schema.giftCardPurchases.merchantId, merchantId)),
        });
        if (!purchase)
            throw new Error("Purchase not found");
        return purchase;
    }
    /** Fulfill after Adyen payment — issue e-card and email recipient */
    static async confirmPurchasePayment(merchantId, purchaseId, pspReference) {
        const db = (0, db_1.getDb)();
        const purchase = await this.getPurchase(merchantId, purchaseId);
        if (purchase.paymentStatus === "completed" && purchase.cardId) {
            const card = await gift_card_service_1.GiftCardService.getById(merchantId, purchase.cardId);
            return { purchase, card, alreadyFulfilled: true };
        }
        const amount = (0, money_1.roundMoney2)(Number(purchase.amount));
        const card = await gift_card_service_1.GiftCardService.credit(merchantId, {
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
                .update(db_1.schema.giftCards)
                .set({
                holderName: purchase.recipientName || card.holderName,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.giftCards.id, card.id));
        }
        try {
            await gift_card_service_1.GiftCardService.sendEcardReceiptEmail(merchantId, {
                to: purchase.recipientEmail,
                code: card.ecardCode || card.cardNumber,
                balance: (0, money_1.roundMoney2)(Number(card.balance)),
                holderName: purchase.recipientName || undefined,
            });
        }
        catch (err) {
            console.warn("Gift card purchase email failed:", err);
        }
        const [updatedPurchase] = await db
            .update(db_1.schema.giftCardPurchases)
            .set({
            paymentStatus: "completed",
            adyenReference: pspReference || purchase.adyenReference,
            cardId: card.id,
            fulfilledAt: new Date(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.giftCardPurchases.id, purchase.id))
            .returning();
        return { purchase: updatedPurchase, card, alreadyFulfilled: false };
    }
    /** Redeem gift card at shop checkout — returns discount amount applied */
    static async redeemForOrder(merchantId, code, orderTotal, orderId) {
        const settings = await gift_card_service_1.GiftCardService.getSettings(merchantId);
        if (!settings.enabled)
            throw new Error("Gift cards are not enabled");
        const result = await gift_card_service_1.GiftCardService.redeem(merchantId, {
            cardNumber: code,
            amount: orderTotal,
            orderId,
            allowPartial: true,
        });
        return {
            amountRedeemed: (0, money_1.roundMoney2)(Number(result.amountRedeemed) || 0),
            remainingBalance: (0, money_1.roundMoney2)(Number(result.remainingBalance) || 0),
            cardId: result.card?.id,
        };
    }
}
exports.ShopGiftCardService = ShopGiftCardService;
//# sourceMappingURL=shop-gift-card.service.js.map