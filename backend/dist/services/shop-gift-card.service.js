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
const email_service_1 = require("@/services/email.service");
const adyen_checkout_env_1 = require("@/lib/adyen-checkout-env");
const shop_public_url_1 = require("@/lib/shop-public-url");
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
function voucherPayloads(code) {
    const normalized = code.trim();
    return {
        code: normalized,
        qrPayload: (0, gift_card_code_1.buildGiftCardRedeemQrPayload)(normalized),
        barcodePayload: (0, gift_card_code_1.buildGiftCardBarcodePayload)(normalized),
        redeemUrl: (0, gift_card_code_1.buildGiftCardRedeemUrl)(normalized),
    };
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
        const digital = settings.digitalVoucherEnabled !== false && settings.onlinePurchaseEnabled !== false;
        const physical = settings.physicalPostEnabled === true && settings.onlinePurchaseEnabled !== false;
        return {
            enabled: this.isOnlineEnabled(settings) && (digital || physical),
            digitalVoucherEnabled: digital,
            physicalPostEnabled: physical,
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
        const payloads = voucherPayloads(ecode);
        return {
            balance,
            ...payloads,
            holderName: card.holderName || null,
            holderEmailMasked: maskEmail(card.holderEmail || card.ecardEmail),
            mediaType: card.cardMediaType,
        };
    }
    static validateDeliveryType(deliveryType, settings) {
        const pub = this.publicSettings(settings);
        if (deliveryType === "digital" && !pub.digitalVoucherEnabled) {
            throw new Error("Digital gift vouchers are not available");
        }
        if (deliveryType === "physical" && !pub.physicalPostEnabled) {
            throw new Error("Physical gift cards by post are not available");
        }
    }
    static async createOnlinePurchase(merchant, slug, input) {
        const settings = this.settingsFromMerchant(merchant);
        if (!this.isOnlineEnabled(settings)) {
            throw new Error("Online gift card purchase is not enabled");
        }
        const deliveryType = input.deliveryType === "physical" ? "physical" : "digital";
        this.validateDeliveryType(deliveryType, settings);
        const check = (0, gift_card_settings_1.validateGiftAmount)(input.amount, settings);
        if (!check.ok)
            throw new Error(check.error);
        const recipientEmail = String(input.recipientEmail || "").trim().toLowerCase();
        if (!recipientEmail.includes("@")) {
            throw new Error("Valid recipient email is required");
        }
        if (deliveryType === "physical") {
            const addr = String(input.shippingAddress || "").trim();
            const city = String(input.shippingCity || "").trim();
            const zip = String(input.shippingZip || "").trim();
            if (!addr || !city || !zip) {
                throw new Error("Complete shipping address is required for physical gift cards");
            }
        }
        const db = (0, db_1.getDb)();
        const [purchase] = await db
            .insert(db_1.schema.giftCardPurchases)
            .values({
            merchantId: merchant.id,
            amount: check.amount.toFixed(2),
            deliveryType,
            recipientEmail,
            recipientName: input.recipientName?.trim() || null,
            senderName: input.senderName?.trim() || null,
            senderEmail: input.senderEmail?.trim().toLowerCase() || null,
            message: input.message?.trim() || null,
            shippingAddress: deliveryType === "physical" ? String(input.shippingAddress || "").trim() : null,
            shippingZip: deliveryType === "physical" ? String(input.shippingZip || "").trim() : null,
            shippingCity: deliveryType === "physical" ? String(input.shippingCity || "").trim() : null,
            shippingCountry: deliveryType === "physical"
                ? String(input.shippingCountry || "CH")
                    .trim()
                    .slice(0, 2)
                    .toUpperCase() || "CH"
                : null,
            paymentMethod: "card",
            paymentStatus: "awaiting_payment",
        })
            .returning();
        const cardReady = (0, adyen_checkout_env_1.shopAdyenCardReady)(merchant);
        let paymentSession = null;
        if (cardReady) {
            try {
                const shopMerchant = {
                    slug: merchant.slug || slug,
                    subdomain: merchant.subdomain,
                    customDomain: merchant.customDomain,
                };
                const checkoutOrigin = (0, shop_public_url_1.resolveShopCheckoutOrigin)(shopMerchant, input.origin);
                const returnUrl = (0, shop_public_url_1.shopGiftCardPaymentReturnUrl)(shopMerchant, purchase.id, {
                    origin: input.origin,
                    shopPath: input.shopPath,
                });
                const session = await adyen_service_1.AdyenService.initializePaymentSession(merchant.id, purchase.id, check.amount, "CHF", returnUrl, checkoutOrigin);
                paymentSession = {
                    id: session.id,
                    sessionData: session.sessionData,
                    clientKey: session.clientKey || merchant.adyenClientId,
                    environment: session.environment || adyen_service_1.AdyenService.environmentFromClientKey(merchant.adyenClientId),
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
                error: "Card payments are not ready. In Settings → Payments, set merchant account, Checkout API key, and client key (test_… or live_… — not the API key).",
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
    static purchasePublicView(purchase, card) {
        const code = card?.ecardCode || null;
        const payloads = code ? voucherPayloads(code) : null;
        return {
            id: purchase.id,
            amount: purchase.amount,
            deliveryType: purchase.deliveryType || "digital",
            recipientEmail: purchase.recipientEmail,
            recipientName: purchase.recipientName,
            senderName: purchase.senderName,
            message: purchase.message,
            paymentStatus: purchase.paymentStatus,
            fulfillmentStatus: purchase.fulfillmentStatus,
            shippingAddress: purchase.shippingAddress,
            shippingZip: purchase.shippingZip,
            shippingCity: purchase.shippingCity,
            shippingCountry: purchase.shippingCountry,
            shippedAt: purchase.shippedAt,
            fulfilledAt: purchase.fulfilledAt,
            cardCode: code,
            cardBalance: card?.balance || null,
            qrPayload: payloads?.qrPayload || null,
            barcodePayload: payloads?.barcodePayload || null,
            redeemUrl: payloads?.redeemUrl || null,
        };
    }
    /** Fulfill after Adyen payment — issue e-card and email recipient or queue physical shipment */
    static async confirmPurchasePayment(merchantId, purchaseId, pspReference) {
        const db = (0, db_1.getDb)();
        const purchase = await this.getPurchase(merchantId, purchaseId);
        if (purchase.paymentStatus === "completed" && purchase.cardId) {
            const card = await gift_card_service_1.GiftCardService.getById(merchantId, purchase.cardId);
            return { purchase, card, alreadyFulfilled: true };
        }
        const amount = (0, money_1.roundMoney2)(Number(purchase.amount));
        const deliveryType = (purchase.deliveryType || "digital");
        const card = await gift_card_service_1.GiftCardService.credit(merchantId, {
            cardMediaType: "e_card",
            ecardEmail: purchase.recipientEmail,
            holderName: purchase.recipientName || undefined,
            amount,
            type: "sell",
            createIfMissing: true,
            skipShiftCheck: true,
        });
        const fulfillmentStatus = deliveryType === "physical" ? "pending_shipment" : "digital_sent";
        if (deliveryType === "digital") {
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
        }
        else {
            const buyerEmail = purchase.senderEmail || purchase.recipientEmail;
            try {
                await email_service_1.EmailService.send({
                    to: buyerEmail,
                    subject: "Gift card order confirmed — shipping soon",
                    html: `<p>Thank you for your gift card order of CHF ${amount.toFixed(2)}.</p>
<p>We will post the physical gift card to:</p>
<p><strong>${purchase.recipientName || "Recipient"}</strong><br/>
${purchase.shippingAddress}<br/>
${purchase.shippingZip} ${purchase.shippingCity}</p>
<p>Redeem code (printed on card): <strong>${card.ecardCode || card.cardNumber}</strong></p>`,
                    text: `Gift card order CHF ${amount.toFixed(2)} confirmed. Shipping to ${purchase.shippingAddress}, ${purchase.shippingZip} ${purchase.shippingCity}. Code: ${card.ecardCode || card.cardNumber}`,
                    merchantId,
                    emailType: "shop_gift_card",
                });
            }
            catch (err) {
                console.warn("Physical gift card confirmation email failed:", err);
            }
        }
        const [updatedPurchase] = await db
            .update(db_1.schema.giftCardPurchases)
            .set({
            paymentStatus: "completed",
            adyenReference: pspReference || purchase.adyenReference,
            cardId: card.id,
            fulfillmentStatus,
            fulfilledAt: deliveryType === "digital" ? new Date() : null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.giftCardPurchases.id, purchase.id))
            .returning();
        return { purchase: updatedPurchase, card, alreadyFulfilled: false };
    }
    /** Merchant: list online purchases awaiting physical shipment */
    static async listPendingShipments(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.giftCardPurchases.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.giftCardPurchases.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.giftCardPurchases.deliveryType, "physical"), (0, drizzle_orm_1.eq)(db_1.schema.giftCardPurchases.paymentStatus, "completed"), (0, drizzle_orm_1.eq)(db_1.schema.giftCardPurchases.fulfillmentStatus, "pending_shipment")),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.giftCardPurchases.createdAt)],
            limit: 100,
        });
    }
    /** Merchant: mark physical gift card as shipped */
    static async markPurchaseShipped(merchantId, purchaseId) {
        const db = (0, db_1.getDb)();
        const purchase = await this.getPurchase(merchantId, purchaseId);
        if (purchase.deliveryType !== "physical") {
            throw new Error("Not a physical gift card order");
        }
        if (purchase.fulfillmentStatus === "shipped") {
            return purchase;
        }
        const [updated] = await db
            .update(db_1.schema.giftCardPurchases)
            .set({
            fulfillmentStatus: "shipped",
            shippedAt: new Date(),
            fulfilledAt: new Date(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.giftCardPurchases.id, purchaseId))
            .returning();
        if (purchase.recipientEmail) {
            try {
                let cardCode = "";
                if (purchase.cardId) {
                    const card = await gift_card_service_1.GiftCardService.getById(merchantId, purchase.cardId);
                    cardCode = card.ecardCode || card.cardNumber;
                }
                await email_service_1.EmailService.send({
                    to: purchase.recipientEmail,
                    subject: "Your gift card is on its way",
                    html: `<p>Your physical gift card (CHF ${Number(purchase.amount).toFixed(2)}) has been posted.</p>
${cardCode ? `<p>Redeem code on the card: <strong>${cardCode}</strong></p>` : ""}`,
                    text: `Your gift card CHF ${Number(purchase.amount).toFixed(2)} has been shipped.${cardCode ? ` Code: ${cardCode}` : ""}`,
                    merchantId,
                    emailType: "shop_gift_card",
                });
            }
            catch (err) {
                console.warn("Ship notification email failed:", err);
            }
        }
        return updated;
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