export declare class OrderService {
    /**
     * Create order
     */
    static createOrder(merchantId: string, items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
    }>, customerId?: string, orderType?: "pos" | "web_shop", paymentMethod?: string, discountAmount?: number, notes?: string): Promise<{
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
     * Get all orders for merchant
     */
    static getOrders(merchantId: string, page?: number, limit?: number, status?: string, startDate?: Date, endDate?: Date): Promise<{
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
     * Get order by ID
     */
    static getOrderById(merchantId: string, orderId: string): Promise<{
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
        paymentTransactions: {
            id: string;
            createdAt: Date;
            status: string;
            merchantId: string;
            currency: string;
            amount: string;
            paymentMethod: string;
            adyenReference: string | null;
            adyenPoiTransactionTs: Date | null;
            completedAt: Date | null;
            orderId: string;
            terminalId: string | null;
        }[];
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
    } & {
        giftCardRemainingBalance?: number | null;
    }>;
    /**
     * Update order status
     */
    static updateOrderStatus(merchantId: string, orderId: string, status: string): Promise<{
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
     * Online / POS lifecycle actions for web_shop (and optionally POS) orders.
     *
     * Flow:
     *  pending|pending_approval → accept → accepted
     *  accepted → start_preparing → preparing
     *  preparing → mark_ready → ready
     *  ready + delivery → out_for_delivery
     *  collect_payment → paymentStatus completed
     *  complete → completed (pickup/dine_in from ready; delivery from out_for_delivery)
     *  reject → cancelled
     */
    static applyOrderAction(merchantId: string, orderId: string, action: string, opts?: {
        paymentMethod?: string | null;
        rejectReason?: string | null;
        estimatedReadyAt?: string | Date | null;
        etaAdjustMinutes?: number | null;
    }): Promise<{
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
     * Update payment status
     */
    static updatePaymentStatus(merchantId: string, orderId: string, paymentStatus: "pending" | "completed" | "failed"): Promise<{
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
     * Get daily sales
     */
    static getDailySales(merchantId: string, date: Date): Promise<{
        date: Date;
        orderCount: number;
        totalRevenue: number;
        totalTax: number;
        totalDiscount: number;
        netRevenue: number;
    }>;
    /**
     * Get sales by payment method
     */
    static getSalesByPaymentMethod(merchantId: string, startDate?: Date, endDate?: Date): Promise<Record<string, number>>;
    /**
     * Cancel order and restore stock
     */
    static cancelOrder(merchantId: string, orderId: string): Promise<{
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
//# sourceMappingURL=order.service.d.ts.map