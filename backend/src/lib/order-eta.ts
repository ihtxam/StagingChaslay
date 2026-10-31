/** Default ready time when staff accepts or auto-accepts an online order. */
export function computeEstimatedReadyAt(
  order: { fulfillmentChannel?: string | null; scheduledFor?: Date | string | null },
  merchant: { pickupEtaMinutes?: number | null; deliveryEtaMinutes?: number | null }
): Date {
  if (order.scheduledFor) {
    return new Date(order.scheduledFor);
  }
  const channel = order.fulfillmentChannel || "takeaway";
  const prepMinutes =
    channel === "delivery"
      ? Number(merchant.deliveryEtaMinutes ?? 45)
      : Number(merchant.pickupEtaMinutes ?? 25);
  return new Date(Date.now() + prepMinutes * 60 * 1000);
}
