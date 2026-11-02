/** Receipt templates selectable in panel + WebPOS (backend `receiptTemplateName`). */
export const RECEIPT_TEMPLATE_NAMES = ['Default'] as const;
export type ReceiptTemplateName = (typeof RECEIPT_TEMPLATE_NAMES)[number];

export function normalizeReceiptTemplateName(raw: unknown): ReceiptTemplateName {
  const name = String(raw ?? 'Default').trim().slice(0, 64);
  return (RECEIPT_TEMPLATE_NAMES as readonly string[]).includes(name)
    ? (name as ReceiptTemplateName)
    : 'Default';
}
