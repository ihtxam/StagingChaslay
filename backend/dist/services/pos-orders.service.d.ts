export declare class PosOrdersService {
    static cancelReasons(): readonly [{
        readonly id: "kitchen_busy";
        readonly en: "Kitchen too busy";
        readonly fr: "Cuisine trop occupée";
        readonly de: "Küche überlastet";
    }, {
        readonly id: "client_cancel";
        readonly en: "Client cancellation";
        readonly fr: "Annulation client";
        readonly de: "Stornierung durch Gast";
    }, {
        readonly id: "out_of_stock";
        readonly en: "Out of stock";
        readonly fr: "Rupture de stock";
        readonly de: "Nicht vorrätig";
    }, {
        readonly id: "wrong_order";
        readonly en: "Wrong order entered";
        readonly fr: "Mauvaise commande saisie";
        readonly de: "Falsche Bestellung erfasst";
    }, {
        readonly id: "could_not_process";
        readonly en: "Could not process order";
        readonly fr: "Impossible de traiter la commande";
        readonly de: "Bestellung konnte nicht verarbeitet werden";
    }, {
        readonly id: "other";
        readonly en: "Other";
        readonly fr: "Autre";
        readonly de: "Sonstiges";
    }];
    static refundReasons(): readonly [{
        readonly id: "didnt_like_food";
        readonly en: "Client didn't like the food";
        readonly fr: "Le client n'a pas aimé le plat";
        readonly de: "Gast mochte das Essen nicht";
    }, {
        readonly id: "service_slow";
        readonly en: "Service was slow";
        readonly fr: "Service trop lent";
        readonly de: "Service war zu langsam";
    }, {
        readonly id: "wrong_order";
        readonly en: "Wrong order";
        readonly fr: "Mauvaise commande";
        readonly de: "Falsche Bestellung";
    }, {
        readonly id: "change_of_mind";
        readonly en: "Change of mind";
        readonly fr: "Changement d'avis";
        readonly de: "Meinungsänderung";
    }, {
        readonly id: "quality_issue";
        readonly en: "Quality / preparation issue";
        readonly fr: "Problème de qualité / préparation";
        readonly de: "Qualitäts- / Zubereitungsproblem";
    }, {
        readonly id: "other";
        readonly en: "Other (custom)";
        readonly fr: "Autre (personnalisé)";
        readonly de: "Sonstiges (frei)";
    }];
    static listPosOrders(merchantId: string, opts?: {
        status?: string;
        from?: string;
        to?: string;
        limit?: number;
        q?: string;
    }): Promise<{
        id: string;
        orderNumber: string;
        clientId: string | null;
        orderType: string;
        orderSource: string | null;
        externalOrderId: string | null;
        status: string;
        channel: string | null;
        paymentMethod: string | null;
        paymentBreakdown: {
            method: string;
            amount: number;
        }[] | null;
        paymentStatus: string | null;
        invoiceNumber: string | null;
        invoiceIssuedAt: Date | null;
        invoiceDueAt: Date | null;
        subtotal: number;
        taxAmount: number;
        discountAmount: number;
        tipAmount: number;
        roundingAmount: number;
        total: number;
        refundAmount: number;
        cancelReason: string | null;
        cancelledAt: Date | null;
        refundedAt: Date | null;
        refundReason: string | null;
        refundHistory: Record<string, unknown>[];
        notes: string | null;
        tableLabel: string | null;
        guestCount: number | null;
        ticketDisplay: string | null;
        tabNumber: string | null;
        staffName: string | null;
        assignedDeliveryStaffId: string | null;
        assignedDriverName: string | null;
        masterOrderId: string | null;
        splitCheckNumber: number | null;
        customerName: string | null;
        pointsEarned: number;
        pointsRedeemed: number;
        customerPhone: string | null;
        shippingAddress: string | null;
        deliveryLatitude: number | null;
        deliveryLongitude: number | null;
        deliveryTrackingToken: string | null;
        scheduledFor: Date | null;
        createdAt: Date;
        completedAt: Date | null;
        adyenReference: string | null;
        adyenCustomerReceiptJson: string | null;
        adyenCashierReceiptJson: string | null;
        items: {
            id: string;
            productId: string | null;
            categoryId: string | null;
            name: string;
            productName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            refundedQuantity: number;
            selectedExtras: {
                id: string;
                name: string;
                price: number;
            }[];
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
            }[];
        }[];
    }[]>;
    static cancelOrder(merchantId: string, orderId: string, reason: string): Promise<{
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
    static updatePaymentMethod(merchantId: string, orderId: string, paymentMethod: string): Promise<{
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
    static refundOrder(merchantId: string, orderId: string, opts?: {
        amount?: number;
        reason?: string;
        /** When set, refund selected line quantities (amount derived from lines). */
        items?: Array<{
            orderItemId: string;
            quantity: number;
        }>;
        /** true = refund entire remaining ticket */
        fullTicket?: boolean;
    }): Promise<{
        order: {
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
        };
        refunded: number;
        refundTotal: number;
        reason: string;
        allocation: {
            giftCard: number;
            cash: number;
            terminal: number;
            other: number;
        };
        terminalRefund: {
            approved: boolean;
            reference: string | null;
            amount: number;
        } | undefined;
    }>;
    /**
     * Goodwill / unreferenced compensation — open amount not capped by order total.
     * May be paid as cash (record only) or via terminal unreferenced refund.
     */
    static goodwillCompensation(merchantId: string, orderId: string, opts: {
        amount: number;
        reason: string;
        method: "cash" | "terminal";
    }): Promise<{
        order: {
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
        };
        compensated: number;
        goodwillTotal: number;
        reason: string;
        method: string;
        terminalReference: string | null;
    }>;
    static listHeld(merchantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        label: string | null;
        staffName: string | null;
        staffId: string | null;
        notes: string | null;
        channel: string | null;
        cartJson: unknown;
    }[]>;
    static holdOrder(merchantId: string, body: {
        id?: string;
        label?: string;
        channel?: string;
        cartJson: unknown;
        notes?: string;
        staffId?: string;
        staffName?: string;
        sendToKitchen?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        label: string | null;
        staffName: string | null;
        staffId: string | null;
        notes: string | null;
        channel: string | null;
        cartJson: unknown;
    }>;
    static deleteHeld(merchantId: string, id: string): Promise<{
        ok: boolean;
    }>;
    /**
     * Remove open held rows after payment — matches ticket #, table, or tab identity.
     * Used by POS checkout (staff may lack CANCEL_ORDERS) and server-side sale sync.
     */
    static releaseHeldByIdentity(merchantId: string, opts: {
        heldId?: string | null;
        ticketDisplay?: string | null;
        tableId?: string | null;
        tabNumber?: string | null;
    }): Promise<{
        released: number;
    }>;
    /**
     * Cancel a held / kitchen-sent order with a required reason.
     * Records a cancelled POS sale for EOD and sales reports, then removes the hold.
     */
    static cancelHeld(merchantId: string, id: string, reason: string): Promise<{
        ok: boolean;
        order: null;
        heldStatus: string;
        cancelReason?: undefined;
    } | {
        ok: boolean;
        order: {
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
        };
        heldStatus: string;
        cancelReason: string;
    }>;
    static resumeHeld(merchantId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        label: string | null;
        staffName: string | null;
        staffId: string | null;
        notes: string | null;
        channel: string | null;
        cartJson: unknown;
    }>;
}
//# sourceMappingURL=pos-orders.service.d.ts.map