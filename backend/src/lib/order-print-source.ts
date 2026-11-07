import type { OrderSource } from "@/lib/delivery-platform-settings";

/** Normalize persisted order_source for kitchen / delivery-platform print routing. */
export function resolveOrderPrintSource(orderSource: string | null | undefined): OrderSource {
  const s = String(orderSource || "")
    .trim()
    .toLowerCase();
  if (s === "justeat") return "justeat";
  if (s === "ubereats") return "ubereats";
  if (s === "qr_table") return "qr_table";
  return "online_shop";
}
