export declare class ShopOrderEmailService {
    static sendGuestOrderEmail(merchantId: string, orderId: string, kind?: 'received' | 'confirmed' | 'ready' | 'out_for_delivery' | 'cancelled', opts?: {
        guestLocale?: string | null;
    }): Promise<void>;
}
//# sourceMappingURL=shop-order-email.service.d.ts.map