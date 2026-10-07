export type GiftCardThemeId = "classic" | "birthday" | "anniversary" | "wedding" | "promotion" | "thank_you";
export type GiftCardThemeDef = {
    id: GiftCardThemeId;
    labelKey: string;
    accent: string;
    emoji: string;
};
export declare const GIFT_CARD_THEMES: GiftCardThemeDef[];
export declare function normalizeGiftCardTheme(raw: unknown): GiftCardThemeId;
export declare function giftCardEmailIntro(input: {
    theme: GiftCardThemeId;
    senderName?: string | null;
    recipientName?: string | null;
    shopName: string;
}): {
    subjectLine: string;
    htmlLead: string;
    textLead: string;
};
//# sourceMappingURL=gift-card-themes.d.ts.map