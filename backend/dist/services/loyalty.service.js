"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = __importDefault(require("crypto"));
class LoyaltyService {
    /**
     * Create loyalty card
     */
    static async createLoyaltyCard(merchantId, cardType, customerId, initialBalance, rfidCardNumber) {
        const db = (0, db_1.getDb)();
        try {
            // Prefer scanned RFID UID from card reader; otherwise generate one
            const cardNumber = (rfidCardNumber && String(rfidCardNumber).trim()) ||
                `RFID-${crypto_1.default.randomBytes(8).toString("hex").toUpperCase()}`;
            const card = await db
                .insert(db_1.schema.loyaltyCards)
                .values({
                merchantId,
                customerId,
                cardType,
                cardNumber,
                balance: initialBalance?.toString() || "0",
                pointsBalance: 0,
                status: "active",
                issuedAt: new Date(),
                expiresAt: cardType === "gift_card"
                    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                    : null,
            })
                .returning();
            return card[0];
        }
        catch (error) {
            console.error("Error creating loyalty card:", error);
            throw error;
        }
    }
    /**
     * Get loyalty card by RFID code
     */
    static async getCardByRFID(merchantId, rfidCode) {
        const db = (0, db_1.getDb)();
        try {
            const card = await db.query.loyaltyCards.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.cardNumber, rfidCode)),
            });
            if (!card) {
                throw new Error("Card not found");
            }
            return card;
        }
        catch (error) {
            console.error("Error getting card by RFID:", error);
            throw error;
        }
    }
    /**
     * Get loyalty card by card number
     */
    static async getCardByNumber(merchantId, cardNumber) {
        const db = (0, db_1.getDb)();
        try {
            const card = await db.query.loyaltyCards.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.cardNumber, cardNumber)),
            });
            if (!card) {
                throw new Error("Card not found");
            }
            return card;
        }
        catch (error) {
            console.error("Error getting card by number:", error);
            throw error;
        }
    }
    /**
     * Get all loyalty cards for merchant
     */
    static async getLoyaltyCards(merchantId, page = 1, limit = 20, cardType, status) {
        const db = (0, db_1.getDb)();
        try {
            const offset = (page - 1) * limit;
            let whereConditions = [(0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId)];
            if (cardType) {
                whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.cardType, cardType));
            }
            if (status) {
                whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.status, status));
            }
            const cards = await db.query.loyaltyCards.findMany({
                where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
                with: {
                    customer: true,
                },
                limit,
                offset,
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.loyaltyCards.issuedAt),
            });
            return cards;
        }
        catch (error) {
            console.error("Error getting loyalty cards:", error);
            throw error;
        }
    }
    /**
     * Add balance to card
     */
    static async addBalance(merchantId, cardId, amount) {
        const db = (0, db_1.getDb)();
        try {
            const card = await db.query.loyaltyCards.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId)),
            });
            if (!card) {
                throw new Error("Card not found");
            }
            const currentBalance = parseFloat(card.balance.toString());
            const newBalance = currentBalance + amount;
            const updatedCard = await db
                .update(db_1.schema.loyaltyCards)
                .set({
                balance: newBalance.toString(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId))
                .returning();
            // Record transaction
            await db.insert(db_1.schema.loyaltyTransactions).values({
                cardId,
                merchantId,
                transactionType: "add_balance",
                amount: amount.toString(),
                balanceAfter: newBalance.toString(),
                description: `Added ${amount} to card balance`,
            });
            return updatedCard[0];
        }
        catch (error) {
            console.error("Error adding balance:", error);
            throw error;
        }
    }
    /**
     * Redeem balance from card
     */
    static async redeemBalance(merchantId, cardId, amount, orderId) {
        const db = (0, db_1.getDb)();
        try {
            const card = await db.query.loyaltyCards.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId)),
            });
            if (!card) {
                throw new Error("Card not found");
            }
            const currentBalance = parseFloat(card.balance.toString());
            if (currentBalance < amount) {
                throw new Error("Insufficient balance");
            }
            const newBalance = currentBalance - amount;
            const updatedCard = await db
                .update(db_1.schema.loyaltyCards)
                .set({
                balance: newBalance.toString(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId))
                .returning();
            // Record transaction
            await db.insert(db_1.schema.loyaltyTransactions).values({
                cardId,
                merchantId,
                orderId,
                transactionType: "redeem",
                amount: amount.toString(),
                balanceAfter: newBalance.toString(),
                description: `Redeemed ${amount} from card`,
            });
            return updatedCard[0];
        }
        catch (error) {
            console.error("Error redeeming balance:", error);
            throw error;
        }
    }
    /**
     * Add loyalty points
     */
    static async addPoints(merchantId, cardId, points) {
        const db = (0, db_1.getDb)();
        try {
            const card = await db.query.loyaltyCards.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId)),
            });
            if (!card) {
                throw new Error("Card not found");
            }
            const currentPoints = parseFloat(card.pointsBalance.toString());
            const newPoints = currentPoints + points;
            const updatedCard = await db
                .update(db_1.schema.loyaltyCards)
                .set({
                pointsBalance: newPoints.toString(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId))
                .returning();
            // Record transaction
            await db.insert(db_1.schema.loyaltyTransactions).values({
                cardId,
                merchantId,
                transactionType: "add_points",
                amount: points.toString(),
                balanceAfter: newPoints.toString(),
                description: `Added ${points} loyalty points`,
            });
            return updatedCard[0];
        }
        catch (error) {
            console.error("Error adding points:", error);
            throw error;
        }
    }
    /**
     * Redeem loyalty points
     */
    static async redeemPoints(merchantId, cardId, points, orderId) {
        const db = (0, db_1.getDb)();
        try {
            const card = await db.query.loyaltyCards.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId)),
            });
            if (!card) {
                throw new Error("Card not found");
            }
            const currentPoints = parseFloat(card.pointsBalance.toString());
            if (currentPoints < points) {
                throw new Error("Insufficient points");
            }
            const newPoints = currentPoints - points;
            const updatedCard = await db
                .update(db_1.schema.loyaltyCards)
                .set({
                pointsBalance: newPoints.toString(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId))
                .returning();
            // Record transaction
            await db.insert(db_1.schema.loyaltyTransactions).values({
                cardId,
                merchantId,
                orderId,
                transactionType: "redeem_points",
                amount: points.toString(),
                balanceAfter: newPoints.toString(),
                description: `Redeemed ${points} loyalty points`,
            });
            return updatedCard[0];
        }
        catch (error) {
            console.error("Error redeeming points:", error);
            throw error;
        }
    }
    /**
     * Get card transaction history
     */
    static async getCardTransactions(merchantId, cardId, page = 1, limit = 20) {
        const db = (0, db_1.getDb)();
        try {
            const offset = (page - 1) * limit;
            const transactions = await db.query.loyaltyTransactions.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyTransactions.cardId, cardId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyTransactions.merchantId, merchantId)),
                limit,
                offset,
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.loyaltyTransactions.createdAt),
            });
            return transactions;
        }
        catch (error) {
            console.error("Error getting card transactions:", error);
            throw error;
        }
    }
    /**
     * Suspend card
     */
    static async suspendCard(merchantId, cardId, reason) {
        const db = (0, db_1.getDb)();
        try {
            const card = await db
                .update(db_1.schema.loyaltyCards)
                .set({
                status: "suspended",
                suspendedReason: reason,
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId)))
                .returning();
            if (card.length === 0) {
                throw new Error("Card not found");
            }
            return card[0];
        }
        catch (error) {
            console.error("Error suspending card:", error);
            throw error;
        }
    }
    /**
     * Reactivate card
     */
    static async reactivateCard(merchantId, cardId) {
        const db = (0, db_1.getDb)();
        try {
            const card = await db
                .update(db_1.schema.loyaltyCards)
                .set({
                status: "active",
                suspendedReason: null,
            })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.id, cardId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId)))
                .returning();
            if (card.length === 0) {
                throw new Error("Card not found");
            }
            return card[0];
        }
        catch (error) {
            console.error("Error reactivating card:", error);
            throw error;
        }
    }
    /**
     * Get loyalty statistics
     */
    static async getLoyaltyStatistics(merchantId) {
        const db = (0, db_1.getDb)();
        try {
            const cards = await db.query.loyaltyCards.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId),
            });
            const totalCards = cards.length;
            const activeCards = cards.filter((c) => c.status === "active").length;
            const totalBalance = cards.reduce((sum, c) => sum + parseFloat(c.balance.toString()), 0);
            const totalPoints = cards.reduce((sum, c) => sum + parseFloat(c.pointsBalance.toString()), 0);
            const giftCards = cards.filter((c) => c.cardType === "gift_card").length;
            const loyaltyCards = cards.filter((c) => c.cardType === "loyalty").length;
            return {
                totalCards,
                activeCards,
                giftCards,
                loyaltyCards,
                totalBalance,
                totalPoints,
                averageBalance: totalCards > 0 ? totalBalance / totalCards : 0,
            };
        }
        catch (error) {
            console.error("Error getting loyalty statistics:", error);
            throw error;
        }
    }
    /**
     * Get expiring gift cards
     */
    static async getExpiringGiftCards(merchantId, daysThreshold = 30) {
        const db = (0, db_1.getDb)();
        try {
            const expirationDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
            const cards = await db.query.loyaltyCards.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyCards.cardType, "gift_card"), (0, drizzle_orm_1.lte)(db_1.schema.loyaltyCards.expiresAt, expirationDate)),
                orderBy: (0, drizzle_orm_2.asc)(db_1.schema.loyaltyCards.expiresAt),
            });
            return cards;
        }
        catch (error) {
            console.error("Error getting expiring gift cards:", error);
            throw error;
        }
    }
    /**
     * Get loyalty program analytics
     */
    static async getLoyaltyAnalytics(merchantId, startDate, endDate) {
        const db = (0, db_1.getDb)();
        try {
            let whereConditions = [(0, drizzle_orm_1.eq)(db_1.schema.loyaltyTransactions.merchantId, merchantId)];
            if (startDate && endDate) {
                whereConditions.push((0, drizzle_orm_1.gte)(db_1.schema.loyaltyTransactions.createdAt, startDate));
                whereConditions.push((0, drizzle_orm_1.lte)(db_1.schema.loyaltyTransactions.createdAt, endDate));
            }
            const transactions = await db.query.loyaltyTransactions.findMany({
                where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
            });
            const totalTransactions = transactions.length;
            const totalRedeemed = transactions
                .filter((t) => t.transactionType === "redeem" || t.transactionType === "redeem_points")
                .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
            const totalAdded = transactions
                .filter((t) => t.transactionType === "add_balance" || t.transactionType === "add_points")
                .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
            const byType = transactions.reduce((acc, t) => {
                acc[t.transactionType] = (acc[t.transactionType] || 0) + 1;
                return acc;
            }, {});
            return {
                totalTransactions,
                totalAdded,
                totalRedeemed,
                netValue: totalAdded - totalRedeemed,
                byType,
            };
        }
        catch (error) {
            console.error("Error getting loyalty analytics:", error);
            throw error;
        }
    }
}
exports.LoyaltyService = LoyaltyService;
// Import missing functions
const drizzle_orm_2 = require("drizzle-orm");
//# sourceMappingURL=loyalty.service.js.map