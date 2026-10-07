/** Infer display/checkout currency for a merchant shop (no DB column yet). */
export declare function inferShopCurrency(input?: {
    country?: string | null;
    currency?: string | null;
}): string;
export declare function formatShopMoney(amount: number, currency: string, locale?: string): string;
//# sourceMappingURL=shop-currency.d.ts.map