import { schema } from "@/db";
export declare class CustomerService {
    /**
     * Create customer
     */
    static createCustomer(merchantId: string, email?: string, phone?: string, firstName?: string, lastName?: string, extra?: {
        defaultAddress?: string | null;
        defaultZip?: string | null;
        defaultCity?: string | null;
    }): Promise<{
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
    }>;
    /**
     * Get all customers for merchant
     */
    static getCustomers(merchantId: string, page?: number, limit?: number, search?: string): Promise<{
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
    }[]>;
    /**
     * Get customer by ID
     */
    static getCustomerById(merchantId: string, customerId: string): Promise<{
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
    }>;
    /**
     * Get customer by email
     */
    static getCustomerByEmail(merchantId: string, email: string): Promise<{
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
    } | undefined>;
    /**
     * Update customer
     */
    static updateCustomer(merchantId: string, customerId: string, updates: Partial<typeof schema.customers.$inferInsert>): Promise<{
        id: string;
        merchantId: string;
        email: string | null;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        passwordHash: string | null;
        defaultAddress: string | null;
        defaultZip: string | null;
        defaultCity: string | null;
        loyaltyPoints: number | null;
        totalSpent: string | null;
        marketingOptIn: boolean;
        lastOrderAt: Date | null;
        lastReorderReminderAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Delete customer
     */
    static deleteCustomer(merchantId: string, customerId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Add loyalty points
     */
    static addLoyaltyPoints(merchantId: string, customerId: string, points: number): Promise<{
        id: string;
        merchantId: string;
        email: string | null;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        passwordHash: string | null;
        defaultAddress: string | null;
        defaultZip: string | null;
        defaultCity: string | null;
        loyaltyPoints: number | null;
        totalSpent: string | null;
        marketingOptIn: boolean;
        lastOrderAt: Date | null;
        lastReorderReminderAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Redeem loyalty points
     */
    static redeemLoyaltyPoints(merchantId: string, customerId: string, points: number): Promise<{
        id: string;
        merchantId: string;
        email: string | null;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        passwordHash: string | null;
        defaultAddress: string | null;
        defaultZip: string | null;
        defaultCity: string | null;
        loyaltyPoints: number | null;
        totalSpent: string | null;
        marketingOptIn: boolean;
        lastOrderAt: Date | null;
        lastReorderReminderAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Get customer purchase history
     */
    static getCustomerPurchaseHistory(merchantId: string, customerId: string): Promise<{
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
            deliveryLatitude: string | null;
            deliveryLongitude: string | null;
            assignedDeliveryStaffId: string | null;
            deliveryTrackingToken: string | null;
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
            items: {
                id: string;
                isOpenPrice: boolean;
                productId: string | null;
                taxAmount: string;
                quantity: string;
                orderId: string;
                productName: string | null;
                unitPrice: string;
                totalPrice: string;
                weightKg: string | null;
                selectedExtras: {
                    id: string;
                    name: string;
                    price: number;
                }[] | null;
                comboSelections: {
                    slotId: string;
                    slotName: string;
                    productId: string;
                    productName: string;
                    extraPrice: number;
                    selectedExtras?: Array<{
                        id: string;
                        name: string;
                        price: number;
                    }>;
                }[] | null;
                seatNumber: number | null;
                refundedQuantity: string | null;
                product: {
                    id: string;
                    name: string;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    merchantId: string;
                    sortOrder: number;
                    description: string | null;
                    imageUrl: string | null;
                    clientId: string | null;
                    categoryId: string | null;
                    sku: string | null;
                    barcode: string | null;
                    price: string;
                    cost: string | null;
                    stock: number;
                    lowStockThreshold: number | null;
                    isTaxable: boolean;
                    productType: string;
                    isOpenPrice: boolean;
                    soldByWeight: boolean;
                    weightUnit: string | null;
                    bulkPricing: {
                        minQty: number;
                        price: number;
                    }[] | null;
                    extras: {
                        id: string;
                        name: string;
                        price: number;
                    }[] | null;
                    comboItems: {
                        id?: string;
                        name?: string;
                        minPick?: number;
                        maxPick?: number;
                        options?: Array<{
                            productId: string;
                            extraPrice?: number;
                        }>;
                        productId?: string;
                        quantity?: number;
                    }[] | null;
                    specifications: {
                        id: string;
                        name: string;
                        price: number;
                        saleStatus?: "in_stock" | "out_of_stock";
                        isDefault?: boolean;
                        sortOrder?: number;
                    }[] | null;
                    buttonColor: string | null;
                    allowExtras: boolean;
                    loyaltyRewardPoints: number | null;
                    recipeYield: string;
                } | null;
            }[];
        }[];
        statistics: {
            totalSpent: number;
            orderCount: number;
            averageOrderValue: number;
        };
    }>;
    /**
     * Get top customers by spending
     */
    static getTopCustomers(merchantId: string, limit?: number): Promise<{
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
    }[]>;
    /**
     * Get customer statistics
     */
    static getCustomerStatistics(merchantId: string): Promise<{
        totalCustomers: number;
        totalLoyaltyPoints: number;
        totalSpent: number;
        averageCustomerValue: number;
    }>;
}
//# sourceMappingURL=customer.service.d.ts.map