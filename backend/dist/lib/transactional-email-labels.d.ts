/** Transactional email copy keyed by customer/shop locale. */
export type TxLocale = 'en' | 'fr' | 'de';
export declare function resolveTxLocale(opts?: {
    guestLocale?: string | null;
    shopLanguage?: string | null;
    panelLanguage?: string | null;
}): TxLocale;
type ReservationKind = 'received' | 'confirmed' | 'rejected' | 'cancelled' | 'seated' | 'reminder';
declare const RES_LABELS: Record<TxLocale, {
    code: string;
    when: string;
    guests: string;
    name: string;
    table: string;
    where: string;
    offer: string;
    questions: string;
}>;
export declare function reservationEmailCopy(kind: ReservationKind, shop: string, locale?: string | null): {
    subject: string;
    body: string;
    labels: (typeof RES_LABELS)['en'];
};
type ShopOrderKind = 'received' | 'confirmed' | 'ready' | 'cancelled';
export declare function shopOrderEmailCopy(kind: ShopOrderKind, shop: string, orderNumber: string, locale?: string | null): {
    subject: string;
    body: string;
};
export {};
//# sourceMappingURL=transactional-email-labels.d.ts.map