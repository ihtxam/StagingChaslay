/** Paid gift cards addon — column, or edition features until the column is assigned. */
export function isGiftCardsLicensed(input: {
  giftCardAddonEnabled?: boolean;
  editionFeatures?: string[] | null;
  features?: string[] | null;
} | null | undefined): boolean {
  if (!input) return false;
  if (input.giftCardAddonEnabled === true) return true;
  const feats = input.editionFeatures ?? input.features;
  if (feats == null) return true;
  return feats.includes('gift_cards') || feats.includes('pos_gift_cards');
}
