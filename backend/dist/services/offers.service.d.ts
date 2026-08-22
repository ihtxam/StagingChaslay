import { schema, type OfferRules, type OfferType } from "@/db";
export type CartLineForOffer = {
    productId: string;
    categoryId?: string | null;
    name: string;
    unitPrice: number;
    quantity: number;
    loyaltyReward?: boolean;
    /** Already baked into unitPrice — skip this offer in evaluateCart */
    offerId?: string | null;
};
export type AppliedOffer = {
    offerId: string;
    name: string;
    badgeLabel: string | null;
    discount: number;
    offerType: string;
};
export declare class OffersService {
    static list(merchantId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        categoryIds: string[];
        productIds: string[];
        offerType: string;
        rules: schema.OfferRules;
        channels: string[];
        scheduleMode: string;
        daysOfWeek: string[];
        timeStart: string | null;
        timeEnd: string | null;
        validFrom: Date | null;
        validTo: Date | null;
        featured: boolean;
        badgeLabel: string | null;
        priority: number;
        stackable: boolean;
    }[]>;
    static get(merchantId: string, offerId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        categoryIds: string[];
        productIds: string[];
        offerType: string;
        rules: schema.OfferRules;
        channels: string[];
        scheduleMode: string;
        daysOfWeek: string[];
        timeStart: string | null;
        timeEnd: string | null;
        validFrom: Date | null;
        validTo: Date | null;
        featured: boolean;
        badgeLabel: string | null;
        priority: number;
        stackable: boolean;
    }>;
    static ensureOffersCategory(merchantId: string): Promise<{
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
    }>;
    static create(merchantId: string, input: {
        name: string;
        description?: string | null;
        offerType: OfferType | string;
        rules?: OfferRules;
        channels?: string[];
        categoryIds?: string[];
        productIds?: string[];
        scheduleMode?: string;
        daysOfWeek?: string[];
        timeStart?: string | null;
        timeEnd?: string | null;
        validFrom?: string | null;
        validTo?: string | null;
        isActive?: boolean;
        featured?: boolean;
        badgeLabel?: string | null;
        priority?: number;
        stackable?: boolean;
    }): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        categoryIds: string[];
        productIds: string[];
        offerType: string;
        rules: schema.OfferRules;
        channels: string[];
        scheduleMode: string;
        daysOfWeek: string[];
        timeStart: string | null;
        timeEnd: string | null;
        validFrom: Date | null;
        validTo: Date | null;
        featured: boolean;
        badgeLabel: string | null;
        priority: number;
        stackable: boolean;
    }>;
    static update(merchantId: string, offerId: string, updates: Record<string, unknown>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        description: string | null;
        offerType: string;
        rules: schema.OfferRules;
        channels: string[];
        categoryIds: string[];
        productIds: string[];
        scheduleMode: string;
        daysOfWeek: string[];
        timeStart: string | null;
        timeEnd: string | null;
        validFrom: Date | null;
        validTo: Date | null;
        isActive: boolean;
        featured: boolean;
        badgeLabel: string | null;
        priority: number;
        stackable: boolean;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static remove(merchantId: string, offerId: string): Promise<{
        success: boolean;
    }>;
    static isOfferActiveAt(offer: typeof schema.offers.$inferSelect, at: Date, channel?: string): boolean;
    static listActivePublic(merchantId: string, at?: Date, channel?: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        categoryIds: string[];
        productIds: string[];
        offerType: string;
        rules: schema.OfferRules;
        channels: string[];
        scheduleMode: string;
        daysOfWeek: string[];
        timeStart: string | null;
        timeEnd: string | null;
        validFrom: Date | null;
        validTo: Date | null;
        featured: boolean;
        badgeLabel: string | null;
        priority: number;
        stackable: boolean;
    }[]>;
    static matchesProduct(offer: typeof schema.offers.$inferSelect, line: CartLineForOffer): boolean;
    static computeOfferDiscount(offer: typeof schema.offers.$inferSelect, lines: CartLineForOffer[]): number;
    /**
     * Choose buyQty from buyProductIds + getQty from getProductIds for packagePrice.
     * Forms as many sets as possible; each set discounts (sum of unit prices − packagePrice).
     */
    static computePackageDealDiscount(rules: OfferRules, lines: CartLineForOffer[]): number;
    /**
     * Pick best non-stackable offer, or sum stackable ones (cap at food total).
     */
    static evaluateCart(offers: Array<typeof schema.offers.$inferSelect>, lines: CartLineForOffer[], at: Date, channel: string): {
        discount: number;
        applied: AppliedOffer[];
    };
    /** Seed a few sensible demo offers for merchants. */
    static seedDemoOffers(merchantId: string, categoryIds?: string[]): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        sortOrder: number;
        description: string | null;
        categoryIds: string[];
        productIds: string[];
        offerType: string;
        rules: schema.OfferRules;
        channels: string[];
        scheduleMode: string;
        daysOfWeek: string[];
        timeStart: string | null;
        timeEnd: string | null;
        validFrom: Date | null;
        validTo: Date | null;
        featured: boolean;
        badgeLabel: string | null;
        priority: number;
        stackable: boolean;
    }[]>;
}
//# sourceMappingURL=offers.service.d.ts.map