import { type GiftCardSettings } from "@/lib/gift-card-settings";
import { type MembershipPlan } from "@/lib/membership-plans";
/** Normalize RFID UIDs so tap / manual / issue all match (strip separators, uppercase). */
export declare function normalizeRfidUid(raw: string): string;
export declare class GiftCardService {
    static getSettings(merchantId: string): Promise<GiftCardSettings>;
    static updateSettings(merchantId: string, patch: Partial<GiftCardSettings>): Promise<GiftCardSettings>;
    static resolveMembershipPlan(settings: GiftCardSettings, planId: string | null | undefined): MembershipPlan | null;
    /** Enrich card JSON with resolved membership plan for POS clients. */
    static enrichCard(card: Record<string, unknown>, settings: GiftCardSettings): {
        membershipPlan: MembershipPlan | null;
        stampCount: {};
        cardKind: string;
    };
    static listCards(merchantId: string, opts?: {
        page?: number;
        limit?: number;
        status?: string;
        q?: string;
    }): Promise<{
        cards: {
            membershipPlan: MembershipPlan | null;
            stampCount: {};
            cardKind: string;
        }[];
        page: number;
        limit: number;
    }>;
    static getById(merchantId: string, cardId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        expiresAt: Date | null;
        customerId: string | null;
        cardNumber: string;
        balance: string;
        pointsBalance: number;
        suspendedReason: string | null;
        issuedAt: Date;
        cardMediaType: string;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
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
    }>;
    static lookup(merchantId: string, code: string, mediaType?: "physical" | "e_card"): Promise<{
        membershipPlan: MembershipPlan | null;
        stampCount: {};
        cardKind: string;
    }>;
    static createCard(merchantId: string, input: {
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
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        expiresAt: Date | null;
        customerId: string | null;
        cardNumber: string;
        balance: string;
        pointsBalance: number;
        suspendedReason: string | null;
        issuedAt: Date;
        cardMediaType: string;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
    }>;
    static credit(merchantId: string, opts: {
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
    }): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        cardMediaType: string;
        balance: string;
        status: string;
        suspendedReason: string | null;
        customerId: string | null;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        pointsBalance: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Redeem stored value. Partial redeem allowed when allowPartial=true
     * (returns amountRedeemed which may be less than requested).
     */
    static redeem(merchantId: string, opts: {
        cardId?: string;
        cardNumber?: string;
        ecardCode?: string;
        amount: number;
        orderId?: string;
        allowPartial?: boolean;
    }): Promise<{
        card: {
            id: string;
            merchantId: string;
            cardNumber: string;
            cardMediaType: string;
            balance: string;
            status: string;
            suspendedReason: string | null;
            customerId: string | null;
            membershipEnabled: boolean;
            membershipPlanId: string | null;
            stampCount: number;
            pointsBalance: number;
            holderName: string | null;
            holderEmail: string | null;
            holderPhone: string | null;
            ecardEmail: string | null;
            ecardCode: string | null;
            issuedAt: Date;
            expiresAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        amountRedeemed: number;
        amountRequested: number;
        remainingBalance: number;
        shortfall: number;
    }>;
    static attachMembership(merchantId: string, cardId: string, input: {
        name?: string;
        email?: string;
        phone?: string;
        customerId?: string;
    }): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        cardMediaType: string;
        balance: string;
        status: string;
        suspendedReason: string | null;
        customerId: string | null;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        pointsBalance: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /** Sell / register a membership card: RFID + customer + tier plan. */
    static sellMembership(merchantId: string, input: {
        cardNumber: string;
        planId: string;
        name: string;
        email?: string;
        phone?: string;
        orderId?: string;
    }): Promise<{
        membershipPlan: MembershipPlan | null;
        stampCount: {};
        cardKind: string;
    }>;
    /** Increment stamp-card progress after a qualifying sale. */
    static incrementStamp(merchantId: string, cardId: string, orderId?: string, increment?: number): Promise<{
        card: {
            membershipPlan: MembershipPlan | null;
            stampCount: {};
            cardKind: string;
        };
        rewardEarned: boolean;
        stampCount: number;
        plan: MembershipPlan;
    }>;
    static refundToCard(merchantId: string, opts: {
        cardId: string;
        amount: number;
        orderId?: string;
    }): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        cardMediaType: string;
        balance: string;
        status: string;
        suspendedReason: string | null;
        customerId: string | null;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        pointsBalance: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static addPoints(merchantId: string, cardId: string, points: number, orderId?: string): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        cardMediaType: string;
        balance: string;
        status: string;
        suspendedReason: string | null;
        customerId: string | null;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        pointsBalance: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static redeemPoints(merchantId: string, cardId: string, points: number, orderId?: string): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        cardMediaType: string;
        balance: string;
        status: string;
        suspendedReason: string | null;
        customerId: string | null;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        pointsBalance: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static suspend(merchantId: string, cardId: string, reason?: string): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        cardMediaType: string;
        balance: string;
        status: string;
        suspendedReason: string | null;
        customerId: string | null;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        pointsBalance: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static reactivate(merchantId: string, cardId: string): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        cardMediaType: string;
        balance: string;
        status: string;
        suspendedReason: string | null;
        customerId: string | null;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        pointsBalance: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /** Email e-gift card receipt with redeem code + balance to recipient. */
    static sendEcardReceiptEmail(merchantId: string, opts: {
        to: string;
        code: string;
        balance: number;
        holderName?: string;
        orderId?: string;
    }): Promise<{
        sent: boolean;
        to: string;
        code: string;
    }>;
    static updateCard(merchantId: string, cardId: string, patch: {
        holderName?: string;
        holderEmail?: string;
        holderPhone?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
    }): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        cardMediaType: string;
        balance: string;
        status: string;
        suspendedReason: string | null;
        customerId: string | null;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        pointsBalance: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /** Merchant admin top-up — balance or stamp progress with audit log. */
    static adminTopUp(merchantId: string, cardId: string, input: {
        type: "balance" | "stamps";
        amount?: number;
        stamps?: number;
        note?: string;
    }): Promise<{
        id: string;
        merchantId: string;
        cardNumber: string;
        cardMediaType: string;
        balance: string;
        status: string;
        suspendedReason: string | null;
        customerId: string | null;
        membershipEnabled: boolean;
        membershipPlanId: string | null;
        stampCount: number;
        pointsBalance: number;
        holderName: string | null;
        holderEmail: string | null;
        holderPhone: string | null;
        ecardEmail: string | null;
        ecardCode: string | null;
        issuedAt: Date;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    } | {
        card: {
            membershipPlan: MembershipPlan | null;
            stampCount: {};
            cardKind: string;
        };
        stampCount: number;
        rewardEarned: boolean;
    }>;
    /** Aggregate purchase history for a member card (customer + gift-card order links). */
    static getMemberSpending(merchantId: string, cardId: string, opts?: {
        page?: number;
        limit?: number;
    }): Promise<{
        statistics: {
            totalSpent: number;
            orderCount: number;
            averageOrderValue: number;
        };
        orders: {
            id: string;
            createdAt: Date;
            status: string;
            merchantId: string;
            deviceId: string | null;
            paymentStatus: string | null;
            paymentMethod: string | null;
            invoiceNumber: string | null;
            clientId: string | null;
            customerId: string | null;
            orderNumber: string;
            orderType: string;
            orderSource: string | null;
            externalOrderId: string | null;
            fulfillmentChannel: string | null;
            subtotal: string;
            taxAmount: string;
            discountAmount: string | null;
            deliveryFee: string | null;
            tipAmount: string | null;
            roundingAmount: string | null;
            amountTendered: string | null;
            changeDue: string | null;
            staffName: string | null;
            staffId: string | null;
            cardFee: string | null;
            pointsDiscount: string | null;
            pointsEarned: number | null;
            pointsRedeemed: number | null;
            total: string;
            invoiceIssuedAt: Date | null;
            invoiceDueAt: Date | null;
            adyenReference: string | null;
            adyenPoiTransactionTs: Date | null;
            adyenCustomerReceiptJson: string | null;
            adyenCashierReceiptJson: string | null;
            notes: string | null;
            shippingAddress: string | null;
            deliveryZoneId: string | null;
            scheduledFor: Date | null;
            customerName: string | null;
            customerPhone: string | null;
            customerEmail: string | null;
            tableId: string | null;
            tableLabel: string | null;
            guestCount: number | null;
            billSplits: {
                id: string;
                label: string;
                seatNumber?: number | null;
                amount: number;
                paymentMethod?: string;
                paymentStatus: string;
                paidAt?: string | null;
            }[] | null;
            masterOrderId: string | null;
            splitCheckNumber: number | null;
            syncedAt: Date | null;
            completedAt: Date | null;
            estimatedReadyAt: Date | null;
            printCount: number | null;
            cancelReason: string | null;
            cancelledAt: Date | null;
            refundAmount: string | null;
            refundedAt: Date | null;
            refundReason: string | null;
            goodwillAmount: string | null;
            paymentBreakdown: {
                method: string;
                amount: number;
            }[] | null;
        }[];
        page: number;
        limit: number;
        total: number;
    }>;
    static getTransactions(merchantId: string, cardId: string, page?: number, limit?: number): Promise<{
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
        pointsAfter: number | null;
    }[]>;
}
//# sourceMappingURL=gift-card.service.d.ts.map