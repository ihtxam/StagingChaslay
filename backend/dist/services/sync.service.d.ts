export interface SyncSaleItem {
    productClientId?: string;
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taxAmount?: number;
    weightKg?: number;
    selectedExtras?: Array<{
        id: string;
        name: string;
        price: number;
    }>;
    comboSelections?: Array<{
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
    }>;
    isOpenPrice?: boolean;
    seatNumber?: number | null;
}
export interface SyncSalePayload {
    clientId: string;
    deviceId?: string;
    orderNumber?: string;
    /** Kitchen / takeaway shout number shown to staff & customers, e.g. #4821 */
    ticketDisplay?: string | null;
    /** Staff-assigned tab / takeaway label (may be non-numeric) */
    tabNumber?: string | null;
    paymentMethod: string;
    paymentStatus?: string;
    /** Order lifecycle status; defaults completed for paid sales, accepted for pay-later */
    status?: string;
    /** Required when status is cancelled — stored on the order for EOD/sales reports */
    cancelReason?: string | null;
    cancelledAt?: string | number | null;
    subtotal: number;
    taxAmount: number;
    discountAmount?: number;
    tipAmount?: number;
    roundingAmount?: number;
    amountTendered?: number | null;
    changeDue?: number | null;
    staffName?: string | null;
    staffId?: string | null;
    total: number;
    notes?: string;
    fulfillmentChannel?: "takeaway" | "dine_in" | "delivery";
    /** Alias used by WebPOS / Android receipt publish */
    channel?: string;
    fulfillment_type?: string;
    fulfillmentType?: string;
    completedAt?: string | number;
    /** ISO / epoch — pickup or delivery time (null/omit = ASAP) */
    scheduledFor?: string | number | null;
    pickup_time_ms?: number | string | null;
    pickupTimeMs?: number | string | null;
    customerId?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    shippingAddress?: string | null;
    deliveryLatitude?: number | string | null;
    deliveryLongitude?: number | string | null;
    lat?: number | string | null;
    lng?: number | string | null;
    tableId?: string | null;
    tableLabel?: string | null;
    guestCount?: number | null;
    billSplits?: Array<{
        id: string;
        label: string;
        seatNumber?: number | null;
        amount: number;
        paymentMethod?: string;
        paymentStatus: string;
        paidAt?: string | null;
    }>;
    /** Shared id for split-bill sibling orders */
    masterOrderId?: string | null;
    /** 1-based split check number */
    splitCheckNumber?: number | null;
    /** Adyen POI transaction id from terminal payment */
    adyenReference?: string | null;
    adyenPoiTransactionTimestamp?: string | null;
    adyenCustomerReceiptJson?: string | null;
    adyenCashierReceiptJson?: string | null;
    /** Split tenders for mixed payments */
    paymentBreakdown?: Array<{
        method: string;
        amount: number;
    }> | null;
    pointsEarned?: number | null;
    pointsRedeemed?: number | null;
    pointsDiscount?: number | null;
    items: SyncSaleItem[];
}
export declare class SyncService {
    /**
     * Pull catalog changes for offline POS devices.
     */
    static pullCatalog(merchantId: string, since?: Date): Promise<{
        serverTime: string;
        categories: {
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
        }[];
        products: {
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
        }[];
        terminals: {
            id: string;
            terminalId: string;
            terminalName: string;
            serialNumber: string | null;
            status: string;
            adyenMerchantAccount: string | null;
            adyenClientId: string | null;
        }[];
        rfidReaders: {
            id: string;
            name: string;
            createdAt: Date;
            status: string;
            merchantId: string;
            lastSeenAt: Date | null;
            readerUid: string;
            connectionType: string;
        }[];
        onlineOrders: {
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
            }[];
        }[];
        diningTables: {
            id: string;
            floorPlanId: string;
            floorPlanName: string;
            label: string;
            capacity: number;
            shape: string;
            posX: number;
            posY: number;
            width: number;
            height: number;
            rotation: number;
            status: string;
            currentOrderId: string | null;
        }[];
        reservations: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            merchantId: string;
            customerId: string | null;
            notes: string | null;
            tableId: string | null;
            tableLabel: string | null;
            cancelledAt: Date | null;
            code: string;
            guestName: string;
            guestEmail: string | null;
            guestPhone: string;
            partySize: number;
            reservedAt: Date;
            durationMinutes: number;
            discountPercent: number | null;
            discountLabel: string | null;
            internalNotes: string | null;
            source: string;
            confirmationSentAt: Date | null;
            reminderSentAt: Date | null;
            acceptedAt: Date | null;
            seatedAt: Date | null;
        }[];
        merchantSettings: {
            taxTakeawayRate: string | null;
            taxDineInRate: string | null;
            taxDeliveryRate: string | null;
            vatRate: string | null;
            slug: string | null;
            subdomain: string | null;
            shopEnabled: boolean;
            floorPlanEnabled: boolean;
            paxOrderingEnabled: boolean;
            reservationsEnabled: boolean;
            adyenMerchantAccount: string | null;
            adyenClientId: string | null;
            panelLanguage: string;
        } | null;
    }>;
    /**
     * Upsert categories/products created offline on the device.
     */
    static pushCatalog(merchantId: string, payload: {
        categories?: Array<{
            clientId: string;
            name: string;
            description?: string;
            sortOrder?: number;
            color?: string;
        }>;
        products?: Array<{
            clientId: string;
            name: string;
            price: number;
            categoryClientId?: string;
            categoryId?: string;
            sku?: string;
            barcode?: string;
            stock?: number;
            isTaxable?: boolean;
            description?: string;
            productType?: string;
            isOpenPrice?: boolean;
            soldByWeight?: boolean;
            weightUnit?: string;
            bulkPricing?: Array<{
                minQty: number;
                price: number;
            }>;
            extras?: Array<{
                id: string;
                name: string;
                price: number;
            }>;
            comboItems?: Array<{
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
            }>;
            allowExtras?: boolean;
            sortOrder?: number;
        }>;
    }): Promise<{
        categoryMap: {
            [k: string]: string;
        };
        productMap: {
            [k: string]: string;
        };
    }>;
    /**
     * Idempotent push of offline sales/orders.
     */
    static pushSales(merchantId: string, sales: SyncSalePayload[]): Promise<{
        results: {
            clientId: string;
            orderId: string;
            created: boolean;
            skipped?: boolean;
            invoiceNumber?: string | null;
        }[];
    }>;
}
//# sourceMappingURL=sync.service.d.ts.map