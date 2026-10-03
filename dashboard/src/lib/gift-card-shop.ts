export type GiftCardThemeId =
  | 'classic'
  | 'birthday'
  | 'anniversary'
  | 'wedding'
  | 'promotion'
  | 'thank_you';

export const SHOP_GIFT_CARD_THEMES: Array<{
  id: GiftCardThemeId;
  labelKey: string;
  emoji: string;
  accent: string;
}> = [
  { id: 'classic', labelKey: 'shopGiftCardThemeClassic', emoji: '🎁', accent: '#0f172a' },
  { id: 'birthday', labelKey: 'shopGiftCardThemeBirthday', emoji: '🎂', accent: '#db2777' },
  { id: 'anniversary', labelKey: 'shopGiftCardThemeAnniversary', emoji: '💜', accent: '#7c3aed' },
  { id: 'wedding', labelKey: 'shopGiftCardThemeWedding', emoji: '💍', accent: '#b45309' },
  { id: 'promotion', labelKey: 'shopGiftCardThemePromotion', emoji: '🎉', accent: '#059669' },
  { id: 'thank_you', labelKey: 'shopGiftCardThemeThankYou', emoji: '✨', accent: '#0284c7' },
];

export type GiftCardFeeSettings = {
  physicalPostFee?: number;
  serviceFeeFlat?: number;
  serviceFeePercent?: number;
  passCardFeeToCustomer?: boolean;
  cardFeePercent?: number;
};

export type GiftCheckoutBreakdown = {
  faceAmount: number;
  shippingFee: number;
  serviceFee: number;
  paymentFee: number;
  totalCharged: number;
};

export function computeShopGiftCheckout(
  faceAmount: number,
  deliveryType: 'digital' | 'physical',
  settings: GiftCardFeeSettings
): GiftCheckoutBreakdown {
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const face = round(faceAmount);
  const shippingFee =
    deliveryType === 'physical' ? round(Math.max(0, Number(settings.physicalPostFee) || 0)) : 0;
  let serviceFee = round(Math.max(0, Number(settings.serviceFeeFlat) || 0));
  const servicePct = Math.max(0, Number(settings.serviceFeePercent) || 0);
  if (servicePct > 0) {
    serviceFee = round(serviceFee + (face + shippingFee) * (servicePct / 100));
  }
  const subtotal = round(face + shippingFee + serviceFee);
  let paymentFee = 0;
  if (settings.passCardFeeToCustomer) {
    const pct = Math.max(0, Number(settings.cardFeePercent) || 0);
    if (pct > 0) paymentFee = round(subtotal * (pct / 100));
  }
  return {
    faceAmount: face,
    shippingFee,
    serviceFee,
    paymentFee,
    totalCharged: round(subtotal + paymentFee),
  };
}
