"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdyenService = void 0;
const axios_1 = __importDefault(require("axios"));
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const ADYEN_API_BASE = process.env.ADYEN_API_BASE || "https://checkout-test.adyen.com/v71";
const ADYEN_API_KEY = process.env.ADYEN_API_KEY;
const ADYEN_MERCHANT_ACCOUNT = process.env.ADYEN_MERCHANT_ACCOUNT;
const ADYEN_CLIENT_ID = process.env.ADYEN_CLIENT_ID;
class AdyenService {
    /**
     * Resolve Adyen credentials: merchant settings (shared for shop + terminals) → env.
     * Legacy per-terminal credential overrides are still honored if present.
     */
    static async resolveCredentials(merchantId, terminalId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        let terminal;
        if (terminalId) {
            terminal =
                (await db.query.paymentTerminals.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.terminalId, terminalId)),
                })) ||
                    (await db.query.paymentTerminals.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.id, terminalId)),
                    })) ||
                    undefined;
        }
        const apiKey = terminal?.adyenApiKey || merchant?.adyenApiKey || ADYEN_API_KEY;
        const merchantAccount = terminal?.adyenMerchantAccount || merchant?.adyenMerchantAccount || ADYEN_MERCHANT_ACCOUNT;
        const clientId = terminal?.adyenClientId || merchant?.adyenClientId || ADYEN_CLIENT_ID;
        if (!apiKey || !merchantAccount) {
            throw new Error("Adyen credentials not configured for this merchant");
        }
        return {
            apiKey,
            merchantAccount,
            clientId,
            terminalId: terminal?.terminalId || terminalId,
        };
    }
    /**
     * Initialize payment session
     */
    static async initializePaymentSession(merchantId, orderId, amount, currency = "USD", returnUrl) {
        try {
            const creds = await this.resolveCredentials(merchantId);
            const response = await axios_1.default.post(`${ADYEN_API_BASE}/sessions`, {
                amount: {
                    value: Math.round(amount * 100), // Convert to cents
                    currency,
                },
                merchantAccount: creds.merchantAccount,
                reference: `${merchantId}-${orderId}`,
                returnUrl: returnUrl || `${process.env.APP_URL}/payment/return`,
                channel: "Web",
                countryCode: "CH",
                ...(creds.clientId ? { clientKey: creds.clientId } : {}),
            }, {
                headers: {
                    "x-api-key": creds.apiKey,
                    "Content-Type": "application/json",
                },
            });
            return response.data;
        }
        catch (error) {
            console.error("Error initializing payment session:", error);
            throw error;
        }
    }
    /**
     * Process payment with card details
     */
    static async processCardPayment(merchantId, orderId, amount, paymentMethod, currency = "USD") {
        try {
            if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
                throw new Error("Adyen credentials not configured");
            }
            const response = await axios_1.default.post(`${ADYEN_API_BASE}/payments`, {
                amount: {
                    value: Math.round(amount * 100),
                    currency,
                },
                paymentMethod,
                merchantAccount: ADYEN_MERCHANT_ACCOUNT,
                reference: `${merchantId}-${orderId}`,
                returnUrl: `${process.env.APP_URL}/payment/return`,
                channel: "Web",
            }, {
                headers: {
                    "x-api-key": ADYEN_API_KEY,
                    "Content-Type": "application/json",
                },
            });
            return response.data;
        }
        catch (error) {
            console.error("Error processing card payment:", error);
            throw error;
        }
    }
    /**
     * Process terminal payment
     */
    static async processTerminalPayment(merchantId, orderId, amount, terminalId, currency = "USD") {
        try {
            const creds = await this.resolveCredentials(merchantId, terminalId);
            const response = await axios_1.default.post(`${ADYEN_API_BASE}/payments`, {
                amount: {
                    value: Math.round(amount * 100),
                    currency,
                },
                paymentMethod: {
                    type: "scheme",
                },
                merchantAccount: creds.merchantAccount,
                reference: `${merchantId}-${orderId}`,
                deviceData: {
                    terminalId: creds.terminalId || terminalId,
                },
                channel: "POS",
            }, {
                headers: {
                    "x-api-key": creds.apiKey,
                    "Content-Type": "application/json",
                },
            });
            return response.data;
        }
        catch (error) {
            console.error("Error processing terminal payment:", error);
            throw error;
        }
    }
    /**
     * Record payment transaction
     */
    static async recordPaymentTransaction(merchantId, orderId, amount, paymentMethod, adyenReference, status, opts) {
        const db = (0, db_1.getDb)();
        try {
            const poiTs = opts?.poiTransactionTimestamp
                ? new Date(opts.poiTransactionTimestamp)
                : null;
            const transaction = await db
                .insert(db_1.schema.paymentTransactions)
                .values({
                orderId,
                merchantId,
                amount: amount.toString(),
                currency: opts?.currency || "CHF",
                paymentMethod,
                status: status === "completed" ? "captured" : status,
                adyenReference,
                adyenPoiTransactionTs: poiTs && !Number.isNaN(poiTs.getTime()) ? poiTs : null,
                completedAt: status === "pending" ? null : new Date(),
            })
                .returning();
            return transaction[0];
        }
        catch (error) {
            console.error("Error recording payment transaction:", error);
            throw error;
        }
    }
    /** Record payment when only POS clientId is known (order may not exist yet). */
    static async recordPaymentTransactionByClientRef(merchantId, clientRef, amount, paymentMethod, adyenReference, status = "captured", opts) {
        const db = (0, db_1.getDb)();
        const ref = String(clientRef || "").trim();
        if (!ref)
            return null;
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.clientId, ref)),
            columns: { id: true },
        });
        if (!order) {
            // WebPOS creates the order after terminal approval — skip until sync completes.
            return null;
        }
        return this.recordPaymentTransaction(merchantId, order.id, amount, paymentMethod, adyenReference, status, opts);
    }
    /**
     * Get payment status
     */
    static async getPaymentStatus(merchantId, reference) {
        try {
            if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
                throw new Error("Adyen credentials not configured");
            }
            const response = await axios_1.default.get(`${ADYEN_API_BASE}/payments/${reference}`, {
                headers: {
                    "x-api-key": ADYEN_API_KEY,
                    "Content-Type": "application/json",
                },
            });
            return response.data;
        }
        catch (error) {
            console.error("Error getting payment status:", error);
            throw error;
        }
    }
    /**
     * Refund payment
     */
    static async refundPayment(merchantId, transactionId, amount) {
        const db = (0, db_1.getDb)();
        try {
            if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
                throw new Error("Adyen credentials not configured");
            }
            const transaction = await db.query.paymentTransactions.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.id, transactionId), (0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.merchantId, merchantId)),
            });
            if (!transaction) {
                throw new Error("Transaction not found");
            }
            const refundAmount = amount || parseFloat(transaction.amount.toString());
            const response = await axios_1.default.post(`${ADYEN_API_BASE}/payments/${transaction.adyenReference}/refunds`, {
                amount: {
                    value: Math.round(refundAmount * 100),
                    currency: "USD",
                },
                merchantAccount: ADYEN_MERCHANT_ACCOUNT,
            }, {
                headers: {
                    "x-api-key": ADYEN_API_KEY,
                    "Content-Type": "application/json",
                },
            });
            // Record refund transaction
            await db.insert(db_1.schema.paymentTransactions).values({
                orderId: transaction.orderId,
                merchantId,
                amount: (-refundAmount).toString(),
                paymentMethod: "refund",
                status: "completed",
                adyenReference: response.data.reference,
                completedAt: new Date(),
            });
            return response.data;
        }
        catch (error) {
            console.error("Error refunding payment:", error);
            throw error;
        }
    }
    /**
     * Get merchant payment methods
     */
    static async getMerchantPaymentMethods(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            });
            if (!merchant) {
                throw new Error("Merchant not found");
            }
            // Default payment methods
            const paymentMethods = [
                {
                    type: "card",
                    name: "Credit/Debit Card",
                    enabled: true,
                },
                {
                    type: "terminal",
                    name: "Payment Terminal",
                    enabled: true,
                },
                {
                    type: "cash",
                    name: "Cash",
                    enabled: true,
                },
            ];
            return paymentMethods;
        }
        catch (error) {
            console.error("Error getting payment methods:", error);
            throw error;
        }
    }
    /**
     * Get transaction history
     */
    static async getTransactionHistory(merchantId, page = 1, limit = 20, status) {
        const db = (0, db_1.getDb)();
        try {
            const offset = (page - 1) * limit;
            let whereConditions = [(0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.merchantId, merchantId)];
            if (status) {
                whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.status, status));
            }
            const transactions = await db.query.paymentTransactions.findMany({
                where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
                limit,
                offset,
                orderBy: [(0, drizzle_orm_2.desc)(db_1.schema.paymentTransactions.completedAt)],
            });
            return transactions;
        }
        catch (error) {
            console.error("Error getting transaction history:", error);
            throw error;
        }
    }
    /**
     * Get payment summary
     */
    static async getPaymentSummary(merchantId, startDate, endDate) {
        const db = (0, db_1.getDb)();
        try {
            let whereConditions = [(0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.merchantId, merchantId)];
            if (startDate && endDate) {
                whereConditions.push((0, drizzle_orm_2.gte)(db_1.schema.paymentTransactions.completedAt, startDate));
                whereConditions.push((0, drizzle_orm_2.lte)(db_1.schema.paymentTransactions.completedAt, endDate));
            }
            const transactions = await db.query.paymentTransactions.findMany({
                where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
            });
            const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
            const byStatus = transactions.reduce((acc, t) => {
                acc[t.status] = (acc[t.status] || 0) + parseFloat(t.amount.toString());
                return acc;
            }, {});
            const byMethod = transactions.reduce((acc, t) => {
                acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + parseFloat(t.amount.toString());
                return acc;
            }, {});
            return {
                totalAmount,
                transactionCount: transactions.length,
                byStatus,
                byMethod,
            };
        }
        catch (error) {
            console.error("Error getting payment summary:", error);
            throw error;
        }
    }
}
exports.AdyenService = AdyenService;
// Import missing functions
const drizzle_orm_2 = require("drizzle-orm");
//# sourceMappingURL=adyen.service.js.map