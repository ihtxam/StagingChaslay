import { schema } from '@/db';
export type PlatformShopProductInput = {
    name: string;
    description?: string | null;
    price: number | string;
    discountPercent?: number | null;
    imageUrl?: string | null;
    isActive?: boolean;
    sortOrder?: number;
};
export type PlatformShopVoucherInput = {
    code: string;
    label?: string | null;
    discountPercent?: number | null;
    discountAmount?: number | string | null;
    isActive?: boolean;
    maxUses?: number | null;
    expiresAt?: string | Date | null;
};
/** Accept only http(s) tracking links for storage and email. */
export declare function sanitizeTrackingUrl(raw?: string | null): string | null;
export declare class PlatformShopService {
    static listProducts(activeOnly?: boolean): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        sortOrder: number;
        description: string | null;
        price: string;
        discountPercent: number | null;
    }[]>;
    static createProduct(input: PlatformShopProductInput): Promise<{
        id: string;
        name: string;
        imageUrl: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        sortOrder: number;
        description: string | null;
        price: string;
        discountPercent: number | null;
    }>;
    static updateProduct(id: string, input: Partial<PlatformShopProductInput>): Promise<{
        id: string;
        name: string;
        description: string | null;
        price: string;
        discountPercent: number | null;
        imageUrl: string | null;
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static deleteProduct(id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        price: string;
        discountPercent: number | null;
        imageUrl: string | null;
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static saveProductImage(buffer: Buffer, mimeType: string, originalName?: string): Promise<{
        filename: string;
        url: string;
        mimeType: string;
        size: number;
    }>;
    static listVouchers(activeOnly?: boolean): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date | null;
        label: string | null;
        discountAmount: string | null;
        code: string;
        discountPercent: number | null;
        maxUses: number | null;
        usedCount: number;
    }[]>;
    static createVoucher(input: PlatformShopVoucherInput): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date | null;
        label: string | null;
        discountAmount: string | null;
        code: string;
        discountPercent: number | null;
        maxUses: number | null;
        usedCount: number;
    }>;
    static deleteVoucher(id: string): Promise<{
        deleted: boolean;
    }>;
    static listVoucherUsage(voucherId: string, limit?: number): Promise<{
        voucher: {
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            expiresAt: Date | null;
            label: string | null;
            discountAmount: string | null;
            code: string;
            discountPercent: number | null;
            maxUses: number | null;
            usedCount: number;
        };
        orders: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            merchantId: string;
            currency: string;
            adyenSessionId: string | null;
            adyenPspReference: string | null;
            adyenResultCode: string | null;
            paidAt: Date | null;
            paymentStatus: string;
            subtotal: string;
            discountAmount: string;
            total: string;
            notes: string | null;
            items: schema.PlatformShopOrderLine[];
            voucherCode: string | null;
            trackingUrl: string | null;
            merchant: {
                id: string;
                name: string;
                email: string;
            };
        }[];
    }>;
    static updateVoucher(id: string, input: Partial<PlatformShopVoucherInput>): Promise<{
        id: string;
        code: string;
        label: string | null;
        discountPercent: number | null;
        discountAmount: string | null;
        isActive: boolean;
        maxUses: number | null;
        usedCount: number;
        expiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static resolveVoucher(code?: string | null): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date | null;
        label: string | null;
        discountAmount: string | null;
        code: string;
        discountPercent: number | null;
        maxUses: number | null;
        usedCount: number;
    } | null>;
    static computeCart(items: Array<{
        productId: string;
        quantity: number;
    }>, catalog: Array<typeof schema.platformShopProducts.$inferSelect>, voucher?: typeof schema.platformShopVouchers.$inferSelect | null): {
        lines: {
            productId: string;
            name: string;
            quantity: number;
            unitPrice: number;
            lineTotal: number;
        }[];
        subtotal: number;
        discountAmount: number;
        total: number;
        voucherCode: string | null;
    };
    static quote(items: Array<{
        productId: string;
        quantity: number;
    }>, voucherCode?: string): Promise<{
        lines: {
            productId: string;
            name: string;
            quantity: number;
            unitPrice: number;
            lineTotal: number;
        }[];
        subtotal: number;
        discountAmount: number;
        total: number;
        voucherCode: string | null;
    }>;
    static startCheckout(merchantId: string, items: Array<{
        productId: string;
        quantity: number;
    }>, opts?: {
        notes?: string;
        voucherCode?: string;
        returnUrl?: string;
    }): Promise<{
        order: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            merchantId: string;
            currency: string;
            adyenSessionId: string | null;
            adyenPspReference: string | null;
            adyenResultCode: string | null;
            paidAt: Date | null;
            paymentStatus: string;
            subtotal: string;
            discountAmount: string;
            total: string;
            notes: string | null;
            items: schema.PlatformShopOrderLine[];
            voucherCode: string | null;
            trackingUrl: string | null;
        };
        free: boolean;
        paymentSession: null;
    } | {
        order: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            merchantId: string;
            currency: string;
            adyenSessionId: string | null;
            adyenPspReference: string | null;
            adyenResultCode: string | null;
            paidAt: Date | null;
            paymentStatus: string;
            subtotal: string;
            discountAmount: string;
            total: string;
            notes: string | null;
            items: schema.PlatformShopOrderLine[];
            voucherCode: string | null;
            trackingUrl: string | null;
        };
        free: boolean;
        paymentSession: {
            id: any;
            sessionData: any;
            clientKey: string;
            environment: "live" | "test";
        };
    }>;
    static confirmPayment(merchantId: string, orderId: string, opts?: {
        resultCode?: string;
        pspReference?: string;
    }): Promise<{
        alreadyPaid: boolean;
        order: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            merchantId: string;
            currency: string;
            adyenSessionId: string | null;
            adyenPspReference: string | null;
            adyenResultCode: string | null;
            paidAt: Date | null;
            paymentStatus: string;
            subtotal: string;
            discountAmount: string;
            total: string;
            notes: string | null;
            items: schema.PlatformShopOrderLine[];
            voucherCode: string | null;
            trackingUrl: string | null;
        };
    } | {
        order: {
            id: string;
            merchantId: string;
            status: string;
            paymentStatus: string;
            subtotal: string;
            discountAmount: string;
            total: string;
            currency: string;
            voucherCode: string | null;
            items: schema.PlatformShopOrderLine[];
            notes: string | null;
            adyenSessionId: string | null;
            adyenPspReference: string | null;
            adyenResultCode: string | null;
            paidAt: Date | null;
            trackingUrl: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
        alreadyPaid?: undefined;
    }>;
    static sendOrderEmails(merchant: {
        id: string;
        name?: string | null;
        email?: string | null;
        panelLanguage?: string | null;
    }, order: typeof schema.platformShopOrders.$inferSelect, lines: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
    }>, total: number): Promise<void>;
    static listMerchantOrders(merchantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        currency: string;
        adyenSessionId: string | null;
        adyenPspReference: string | null;
        adyenResultCode: string | null;
        paidAt: Date | null;
        paymentStatus: string;
        subtotal: string;
        discountAmount: string;
        total: string;
        notes: string | null;
        items: schema.PlatformShopOrderLine[];
        voucherCode: string | null;
        trackingUrl: string | null;
    }[]>;
    static getMerchantOrder(merchantId: string, orderId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        currency: string;
        adyenSessionId: string | null;
        adyenPspReference: string | null;
        adyenResultCode: string | null;
        paidAt: Date | null;
        paymentStatus: string;
        subtotal: string;
        discountAmount: string;
        total: string;
        notes: string | null;
        items: schema.PlatformShopOrderLine[];
        voucherCode: string | null;
        trackingUrl: string | null;
    }>;
    static listAllOrders(limit?: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        currency: string;
        adyenSessionId: string | null;
        adyenPspReference: string | null;
        adyenResultCode: string | null;
        paidAt: Date | null;
        paymentStatus: string;
        subtotal: string;
        discountAmount: string;
        total: string;
        notes: string | null;
        items: schema.PlatformShopOrderLine[];
        voucherCode: string | null;
        trackingUrl: string | null;
        merchant: {
            id: string;
            name: string;
            email: string;
        };
    }[]>;
    static updateOrderStatus(orderId: string, status: string, trackingUrl?: string | null): Promise<{
        id: string;
        merchantId: string;
        status: string;
        paymentStatus: string;
        subtotal: string;
        discountAmount: string;
        total: string;
        currency: string;
        voucherCode: string | null;
        items: schema.PlatformShopOrderLine[];
        notes: string | null;
        adyenSessionId: string | null;
        adyenPspReference: string | null;
        adyenResultCode: string | null;
        paidAt: Date | null;
        trackingUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static sendStatusEmails(order: typeof schema.platformShopOrders.$inferSelect): Promise<void>;
}
//# sourceMappingURL=platform-shop.service.d.ts.map