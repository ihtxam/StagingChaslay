type PrivacyLocale = "en" | "fr" | "de" | "it";
export type ShopPrivacyMerchant = {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    shopLanguage?: string | null;
    panelLanguage?: string | null;
};
export declare const SHOP_PRIVACY_POLICY_SLUG = "privacy-policy";
export declare function resolvePrivacyContactName(merchant: ShopPrivacyMerchant, managerStaffName?: string | null): string;
export declare function buildDefaultPrivacyPolicyHtml(merchant: ShopPrivacyMerchant, contactName?: string | null): {
    title: string;
    htmlContent: string;
    locale: PrivacyLocale;
};
export {};
//# sourceMappingURL=shop-privacy-policy.d.ts.map