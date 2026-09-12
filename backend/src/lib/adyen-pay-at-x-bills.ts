import { roundMoney2 } from "@/lib/money";
import { isFullyPaidTicket } from "@/lib/pos-open-ticket";

export type OpenBillRow = {
  id: string;
  label?: string | null;
  staffId?: string | null;
  cartJson: unknown;
  paidTotal?: string | number | null;
};

export type HeldBillIdentity = {
  ticketDisplay: string | null;
  tableId: string | null;
  tabNumber: string | null;
  tableLabel: string | null;
};

export function parseReferenceFromEventDetails(eventDetails?: string | null): string | null {
  if (!eventDetails) return null;
  const trimmed = String(eventDetails).trim();
  if (!trimmed) return null;

  const kvMatch = trimmed.match(/(?:^|[&,;\s])reference_id=([^&,;\s]+)/i);
  if (kvMatch?.[1]) return kvMatch[1].trim();

  const digits = trimmed.replace(/\D/g, "");
  return digits || trimmed;
}

export function normalizeHeldTicket(value?: string | null): string {
  const raw = String(value || "")
    .trim()
    .replace(/^#/, "");
  return raw ? `#${raw}` : "";
}

export function heldBillIdentity(cartJson: unknown): HeldBillIdentity {
  const data = normalizeHeldCartJson(cartJson);
  if (!data || Array.isArray(data)) {
    return { ticketDisplay: null, tableId: null, tabNumber: null, tableLabel: null };
  }
  const ticket = typeof data.ticketDisplay === "string" ? data.ticketDisplay.trim() : "";
  const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
  const tab = data.tabNumber != null ? String(data.tabNumber).trim() : "";
  const tableLabel = typeof data.tableLabel === "string" ? data.tableLabel.trim() : "";
  return {
    ticketDisplay: ticket || null,
    tableId: tableId || null,
    tabNumber: tab || null,
    tableLabel: tableLabel || null,
  };
}

export function heldCartTotal(cartJson: unknown): number {
  const data = normalizeHeldCartJson(cartJson);
  const cart = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { cart?: unknown }).cart)
      ? (data as { cart: Array<{ lineTotal?: unknown }> }).cart
      : [];
  return cart.reduce((sum, line) => sum + (Number(line?.lineTotal) || 0), 0);
}

export function billDisplayLabel(row: OpenBillRow): string {
  const ident = heldBillIdentity(row.cartJson);
  if (ident.ticketDisplay) return normalizeHeldTicket(ident.ticketDisplay);
  if (ident.tableLabel) return ident.tableLabel;
  if (row.label?.trim()) return row.label.trim();
  if (ident.tableId) return `Table ${ident.tableId}`;
  if (ident.tabNumber) return `Tab ${ident.tabNumber}`;
  return `Bill ${row.id.slice(0, 8)}`;
}

export function filterOpenBillsForStaff(
  bills: OpenBillRow[],
  staffId?: string | null
): OpenBillRow[] {
  if (!staffId) return bills;
  const staffBills = bills.filter((b) => b.staffId === staffId);
  return staffBills.length ? staffBills : bills;
}

export function matchBillByTableInput(bills: OpenBillRow[], input: string): OpenBillRow[] {
  const needle = String(input || "").trim().toLowerCase();
  if (!needle) return [];

  const bareNeedle = needle.replace(/^#/, "");
  return bills.filter((row) => {
    const ident = heldBillIdentity(row.cartJson);
    const ticket = normalizeHeldTicket(ident.ticketDisplay).toLowerCase();
    const tableId = String(ident.tableId || "").toLowerCase();
    const tableLabel = String(ident.tableLabel || "").toLowerCase();
    const tab = String(ident.tabNumber || "").toLowerCase();
    const label = String(row.label || "").toLowerCase();

    if (ticket && (ticket === `#${bareNeedle}` || ticket.includes(needle))) return true;
    if (tableId && (tableId === bareNeedle || tableId.includes(needle))) return true;
    if (tableLabel && tableLabel.includes(needle)) return true;
    if (tab && (tab === bareNeedle || tab.includes(needle))) return true;
    if (label && label.includes(needle)) return true;
    return false;
  });
}

export function calcSplitPaymentAmounts(cartTotal: number, paidSoFar: number) {
  const total = roundMoney2(Math.max(0, cartTotal));
  const paid = roundMoney2(Math.max(0, paidSoFar));
  const requestedAmount = roundMoney2(Math.max(0, total - paid));
  return {
    cartTotal: total,
    paidAmount: paid,
    requestedAmount,
    fullyPaid: isFullyPaidTicket(total, paid),
  };
}

function normalizeHeldCartJson(cartJson: unknown): {
  cart?: Array<{ lineTotal?: unknown }>;
  tableId?: string | null;
  tableLabel?: string | null;
  tabNumber?: string | null;
  ticketDisplay?: string | null;
} | Array<{ lineTotal?: unknown }> | null {
  let data: unknown = cartJson;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (Array.isArray(data) || (data && typeof data === "object")) {
    return data as {
      cart?: Array<{ lineTotal?: unknown }>;
      tableId?: string | null;
      tableLabel?: string | null;
      tabNumber?: string | null;
      ticketDisplay?: string | null;
    };
  }
  return null;
}
