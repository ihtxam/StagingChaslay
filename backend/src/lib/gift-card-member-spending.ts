/** Transaction types that tie a gift/member card to an order for spending stats. */
export function memberSpendingOrderTransactionTypes(): readonly string[] {
  return [
    "redeem",
    "sell",
    "points_earn",
    "points_redeem",
    "stamp_earn",
    "stamp_reward",
  ];
}
