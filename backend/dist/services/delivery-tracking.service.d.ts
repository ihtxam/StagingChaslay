export type DeliveryDriverLive = {
    staffId: string;
    staffName: string;
    roleName: string | null;
    latitude: number;
    longitude: number;
    accuracyM: number | null;
    heading: number | null;
    speedMps: number | null;
    recordedAt: string;
    stale: boolean;
    activeOrderCount: number;
};
export type DeliveryOrderOnMap = {
    id: string;
    orderNumber: string;
    status: string;
    customerName: string | null;
    customerPhone: string | null;
    shippingAddress: string | null;
    latitude: number | null;
    longitude: number | null;
    assignedDeliveryStaffId: string | null;
    assignedDriverName: string | null;
    total: number;
    createdAt: string | null;
    orderSource: string | null;
    orderType: string | null;
    paymentStatus: string | null;
    paymentMethod: string | null;
    printCount: number;
    deliveryTrackingToken: string | null;
    itemsPreview: string | null;
    itemCount: number;
};
export declare class DeliveryTrackingService {
    static ensureSchema(): Promise<void>;
    /** Upsert latest driver position (one row per staff). */
    static postLocation(merchantId: string, staffId: string, input: {
        latitude: number;
        longitude: number;
        accuracyM?: number | null;
        heading?: number | null;
        speedMps?: number | null;
    }): Promise<{
        success: true;
        recordedAt: string;
    }>;
    static listLiveDrivers(merchantId: string): Promise<DeliveryDriverLive[]>;
    static listActiveDeliveryOrders(merchantId: string): Promise<DeliveryOrderOnMap[]>;
    /** Ensure delivery orders have a tracking / driver-scan token. */
    static ensureDeliveryTrackingToken(merchantId: string, orderId: string): Promise<string>;
    static assignDriver(merchantId: string, orderId: string, staffId: string | null): Promise<{
        success: true;
        orderId: string;
        assignedDeliveryStaffId: string | null;
    }>;
    /** Driver scans delivery slip QR — assigns order to clocked-in driver. */
    static claimOrderAsDriver(merchantId: string, staffId: string, orderId: string, token: string): Promise<{
        success: true;
        orderId: string;
        assignedDeliveryStaffId: string;
        assignedDriverName: string | null;
    }>;
    /** List delivery-role staff for assign dropdown. */
    static listDeliveryStaff(merchantId: string): Promise<{
        id: string;
        name: string;
        roleId: string;
    }[]>;
    /** Guest tracking payload (token required). */
    static getPublicTracking(merchantId: string, orderId: string, token: string): Promise<{
        order: {
            id: string;
            orderNumber: string;
            status: string;
            shippingAddress: string | null;
            destination: {
                latitude: number | null;
                longitude: number | null;
            };
            estimatedReadyAt: string | null;
        };
        store: {
            name: string;
            latitude: number | null;
            longitude: number | null;
        };
        driver: {
            name: string;
            latitude: number;
            longitude: number;
            recordedAt: string;
            stale: boolean;
        } | null;
    }>;
    /** Driver marks assigned delivery complete. */
    static completeDeliveryAsDriver(merchantId: string, staffId: string, orderId: string): Promise<{
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
    /** Driver starts delivery — mark ready (if needed) and out for delivery. */
    static startDeliveryAsDriver(merchantId: string, staffId: string, orderId: string): Promise<{
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
    }>;
    /**
     * Kitchen → delivery transitions for an assigned driver order:
     * preparing/accepted → ready → out_for_delivery.
     * Pending orders must be accepted at the till first (unless auto-accepted).
     */
    static advanceDeliveryForDriver(merchantId: string, orderId: string): Promise<{
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
    }>;
    /** Latest driver ping for an order (merchant orders board). */
    static getDriverPingForOrder(merchantId: string, orderId: string): Promise<{
        staffId: string;
        staffName: string;
        latitude: null;
        longitude: null;
        stale: boolean;
        recordedAt?: undefined;
    } | {
        staffId: string;
        staffName: string;
        latitude: number | null;
        longitude: number | null;
        recordedAt: string;
        stale: boolean;
    } | null>;
    /** Completed deliveries for driver (today by default). */
    static listCompletedForDriver(merchantId: string, staffId: string, dateYmd?: string): Promise<{
        id: string;
        orderNumber: string;
        total: number;
        completedAt: string | null;
        customerName: string | null;
        shippingAddress: string | null;
    }[]>;
    /** Seed demo driver positions around merchant HQ (for demo merchant). */
    static seedDemoDriverLocations(merchantId: string, drivers: Array<{
        staffId: string;
        lat: number;
        lng: number;
    }>): Promise<void>;
}
//# sourceMappingURL=delivery-tracking.service.d.ts.map