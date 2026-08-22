import { type FulfillmentChannel } from "@/services/merchant-settings.service";
export declare class WebShopService {
    /**
     * Get public merchant shop info
     */
    static getShopInfo(merchantId: string): Promise<{
        id: string;
        name: string;
        address: string | null;
        city: string | null;
        country: string | null;
        phone: string | null;
        email: string;
    }>;
    /**
     * Get public products for web shop
     */
    static getPublicProducts(merchantId: string, page?: number, limit?: number, categoryId?: string, search?: string): Promise<{
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
        category: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            merchantId: string;
            sortOrder: number;
            description: string | null;
            color: string | null;
            imageUrl: string | null;
            isOffersCategory: boolean;
            clientId: string | null;
        } | null;
    }[]>;
    /**
     * Get public categories
     */
    static getPublicCategories(merchantId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        color: string | null;
        imageUrl: string | null;
        isOffersCategory: boolean;
        clientId: string | null;
    }[]>;
    /**
     * Create web shop order
     */
    static createWebShopOrder(merchantId: string, items: Array<{
        productId: string;
        quantity: number;
    }>, customerEmail: string, customerPhone?: string, customerName?: string, shippingAddress?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    }, notes?: string, fulfillmentChannel?: FulfillmentChannel): Promise<{
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
    }>;
    /**
     * Get web shop orders
     */
    static getWebShopOrders(merchantId: string, page?: number, limit?: number, status?: string): Promise<{
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
    }[]>;
    /**
     * Update order shipping status
     */
    static updateShippingStatus(merchantId: string, orderId: string, shippingStatus: "pending" | "processing" | "shipped" | "delivered"): Promise<{
        id: string;
        merchantId: string;
        orderNumber: string;
        customerId: string | null;
        orderType: string;
        orderSource: string | null;
        externalOrderId: string | null;
        fulfillmentChannel: string | null;
        status: string;
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
        paymentMethod: string | null;
        paymentStatus: string | null;
        invoiceNumber: string | null;
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
        clientId: string | null;
        deviceId: string | null;
        syncedAt: Date | null;
        createdAt: Date;
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
    }>;
    /**
     * Get web shop analytics
     */
    static getWebShopAnalytics(merchantId: string, startDate?: Date, endDate?: Date): Promise<{
        totalOrders: number;
        completedOrders: number;
        totalRevenue: number;
        averageOrderValue: number;
        byStatus: Record<string, number>;
    }>;
    /**
     * Sync web shop order to POS
     */
    static syncOrderToPOS(merchantId: string, orderId: string): Promise<{
        id: string;
        merchantId: string;
        orderNumber: string;
        customerId: string | null;
        orderType: string;
        orderSource: string | null;
        externalOrderId: string | null;
        fulfillmentChannel: string | null;
        status: string;
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
        paymentMethod: string | null;
        paymentStatus: string | null;
        invoiceNumber: string | null;
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
        clientId: string | null;
        deviceId: string | null;
        syncedAt: Date | null;
        createdAt: Date;
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
    }>;
}
//# sourceMappingURL=webshop.service.d.ts.map