export declare class LoyaltyService {
    /**
     * Create loyalty card
     */
    static createLoyaltyCard(merchantId: string, cardType: "loyalty" | "gift_card", customerId?: string, initialBalance?: number, rfidCardNumber?: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        merchantId: string;
        expiresAt: Date | null;
        customerId: string | null;
        cardNumber: string;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        suspendedReason: string | null;
        issuedAt: Date;
    }>;
    /**
     * Get loyalty card by RFID code
     */
    static getCardByRFID(merchantId: string, rfidCode: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        merchantId: string;
        expiresAt: Date | null;
        customerId: string | null;
        cardNumber: string;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        suspendedReason: string | null;
        issuedAt: Date;
    }>;
    /**
     * Get loyalty card by card number
     */
    static getCardByNumber(merchantId: string, cardNumber: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        merchantId: string;
        expiresAt: Date | null;
        customerId: string | null;
        cardNumber: string;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        suspendedReason: string | null;
        issuedAt: Date;
    }>;
    /**
     * Get all loyalty cards for merchant
     */
    static getLoyaltyCards(merchantId: string, page?: number, limit?: number, cardType?: string, status?: string): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        merchantId: string;
        expiresAt: Date | null;
        customerId: string | null;
        cardNumber: string;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        suspendedReason: string | null;
        issuedAt: Date;
        customer: {
            id: string;
            email: string | null;
            passwordHash: string | null;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            merchantId: string;
            firstName: string | null;
            lastName: string | null;
            defaultAddress: string | null;
            defaultZip: string | null;
            defaultCity: string | null;
            loyaltyPoints: number | null;
            totalSpent: string | null;
            marketingOptIn: boolean;
            lastOrderAt: Date | null;
            lastReorderReminderAt: Date | null;
        } | null;
    }[]>;
    /**
     * Add balance to card
     */
    static addBalance(merchantId: string, cardId: string, amount: number): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        customerId: string | null;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        status: string;
        suspendedReason: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
    }>;
    /**
     * Redeem balance from card
     */
    static redeemBalance(merchantId: string, cardId: string, amount: number, orderId?: string): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        customerId: string | null;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        status: string;
        suspendedReason: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
    }>;
    /**
     * Add loyalty points
     */
    static addPoints(merchantId: string, cardId: string, points: number): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        customerId: string | null;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        status: string;
        suspendedReason: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
    }>;
    /**
     * Redeem loyalty points
     */
    static redeemPoints(merchantId: string, cardId: string, points: number, orderId?: string): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        customerId: string | null;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        status: string;
        suspendedReason: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
    }>;
    /**
     * Get card transaction history
     */
    static getCardTransactions(merchantId: string, cardId: string, page?: number, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        merchantId: string;
        description: string | null;
        amount: string | null;
        transactionType: string;
        orderId: string | null;
        cardId: string;
        points: number | null;
        balanceAfter: string | null;
    }[]>;
    /**
     * Suspend card
     */
    static suspendCard(merchantId: string, cardId: string, reason?: string): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        customerId: string | null;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        status: string;
        suspendedReason: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
    }>;
    /**
     * Reactivate card
     */
    static reactivateCard(merchantId: string, cardId: string): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        customerId: string | null;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        status: string;
        suspendedReason: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
    }>;
    /**
     * Get loyalty statistics
     */
    static getLoyaltyStatistics(merchantId: string): Promise<{
        totalCards: number;
        activeCards: number;
        giftCards: number;
        loyaltyCards: number;
        totalBalance: number;
        totalPoints: number;
        averageBalance: number;
    }>;
    /**
     * Get expiring gift cards
     */
    static getExpiringGiftCards(merchantId: string, daysThreshold?: number): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        merchantId: string;
        expiresAt: Date | null;
        customerId: string | null;
        cardNumber: string;
        cardType: string;
        balance: string | null;
        pointsBalance: number | null;
        suspendedReason: string | null;
        issuedAt: Date;
    }[]>;
    /**
     * Get loyalty program analytics
     */
    static getLoyaltyAnalytics(merchantId: string, startDate?: Date, endDate?: Date): Promise<{
        totalTransactions: number;
        totalAdded: number;
        totalRedeemed: number;
        netValue: number;
        byType: Record<string, number>;
    }>;
}
//# sourceMappingURL=loyalty.service.d.ts.map