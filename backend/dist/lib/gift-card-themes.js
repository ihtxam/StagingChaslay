"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GIFT_CARD_THEMES = void 0;
exports.normalizeGiftCardTheme = normalizeGiftCardTheme;
exports.giftCardEmailIntro = giftCardEmailIntro;
exports.GIFT_CARD_THEMES = [
    { id: "classic", labelKey: "shopGiftCardThemeClassic", accent: "#0f172a", emoji: "🎁" },
    { id: "birthday", labelKey: "shopGiftCardThemeBirthday", accent: "#db2777", emoji: "🎂" },
    { id: "anniversary", labelKey: "shopGiftCardThemeAnniversary", accent: "#7c3aed", emoji: "💜" },
    { id: "wedding", labelKey: "shopGiftCardThemeWedding", accent: "#b45309", emoji: "💍" },
    { id: "promotion", labelKey: "shopGiftCardThemePromotion", accent: "#059669", emoji: "🎉" },
    { id: "thank_you", labelKey: "shopGiftCardThemeThankYou", accent: "#0284c7", emoji: "✨" },
];
function normalizeGiftCardTheme(raw) {
    const id = String(raw || "classic").trim().toLowerCase();
    if (exports.GIFT_CARD_THEMES.some((t) => t.id === id))
        return id;
    return "classic";
}
function giftCardEmailIntro(input) {
    const sender = String(input.senderName || "").trim() || "Someone special";
    const recipient = String(input.recipientName || "").trim();
    const you = recipient ? recipient : "you";
    const byTheme = {
        classic: { occasion: "a gift", subjectSuffix: "sent you a gift card" },
        birthday: { occasion: "your birthday", subjectSuffix: "sent you a birthday gift card" },
        anniversary: { occasion: "your anniversary", subjectSuffix: "sent you an anniversary gift card" },
        wedding: { occasion: "your wedding", subjectSuffix: "sent you a wedding gift card" },
        promotion: { occasion: "your celebration", subjectSuffix: "sent you a gift card to celebrate" },
        thank_you: { occasion: "you", subjectSuffix: "sent you a thank-you gift card" },
    };
    const t = byTheme[input.theme] || byTheme.classic;
    const subjectLine = `${input.shopName} · ${sender} ${t.subjectSuffix}`;
    const htmlLead = `<strong>${sender.replace(/</g, "&lt;")}</strong> sent ${you.replace(/</g, "&lt;")} a gift card for ${t.occasion.replace(/</g, "&lt;")}.`;
    const textLead = `${sender} sent ${you} a gift card for ${t.occasion}.`;
    return { subjectLine, htmlLead, textLead };
}
//# sourceMappingURL=gift-card-themes.js.map