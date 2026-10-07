import type { TxLocale } from '@/lib/transactional-email-labels';
export type ShopOrderEmailKind = 'received' | 'confirmed' | 'ready' | 'out_for_delivery' | 'cancelled';
export type ShopOrderEmailItem = {
    quantity: string;
    name: string;
    unitPrice: string;
    totalPrice: string;
};
export type ShopOrderEmailTemplateInput = {
    kind: ShopOrderEmailKind;
    locale: TxLocale;
    shopName: string;
    orderNumber: string;
    customerName: string;
    body: string;
    fulfillmentChannel: string | null | undefined;
    paymentMethod: string | null | undefined;
    subtotal: string;
    discountTotal: string;
    total: string;
    items: ShopOrderEmailItem[];
    scheduledLabel: string | null;
    etaMinutes: number | null;
    pickupLines: string[];
    merchantPhone: string | null;
    merchantEmail: string | null;
    notes: string | null;
    trackingUrl: string | null;
    trackLabel: string;
};
export declare function buildShopOrderGuestEmailHtml(input: ShopOrderEmailTemplateInput): string;
export declare function buildShopOrderGuestEmailText(input: ShopOrderEmailTemplateInput): string;
export declare function cleanOrderNotes(raw: string | null | undefined): string | null;
export declare function etaMinutesFromReadyAt(estimatedReadyAt: Date | string | null | undefined): number | null;
export declare function buildPickupLines(opts: {
    shopName: string;
    merchantAddress?: string | null;
    merchantCity?: string | null;
    merchantCountry?: string | null;
    locationName?: string | null;
    locationAddress?: string | null;
    locationCity?: string | null;
    locationCountry?: string | null;
    shippingAddress?: string | null;
    fulfillmentChannel?: string | null;
}): string[];
//# sourceMappingURL=shop-order-email-template.d.ts.map