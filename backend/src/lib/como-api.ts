/**
 * Como Sense API v4 helpers.
 * Endpoints and field names are taken from the public FAQ / knowledge-center articles.
 * Do not add paths that are not named in those docs.
 */

export type ComoIdentifier = {
  phoneNumber?: string;
  email?: string;
  membershipKey?: string;
};

export type ComoPurchaseItem = {
  lineId: string;
  itemCode: string;
  quantity: number;
  price: number;
};

export type ComoPurchase = {
  transactionId: string;
  posId?: string;
  orderType?: string;
  totalAmount?: number;
  items: ComoPurchaseItem[];
};

export type ComoAsset = {
  key: string;
  name?: string;
  type?: string;
  status?: string;
  redeemable?: boolean;
  description?: string;
  punches?: number | null;
  punchesRequired?: number | null;
  itemsSelection?: unknown;
};

export type ComoMemberSnapshot = {
  membershipKey?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  pointsBalance?: number | null;
  creditBalance?: number | null;
  usedByPayment?: boolean | null;
  notFound?: boolean;
  assets: ComoAsset[];
};

export type ComoBenefitDiscount = {
  amountMinor: number;
  itemCode?: string;
  dealCode?: string;
  lineId?: string;
  name?: string;
};

export type ComoCartLineInput = {
  lineId?: string;
  itemCode?: string;
  sku?: string;
  barcode?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** FAQ: POS partners must support phone and email. QR / member code uses membershipKey. */
export function classifyComoIdentifier(raw: string): ComoIdentifier {
  const value = String(raw || "").trim();
  if (!value) return {};
  if (EMAIL_RE.test(value)) return { email: value.slice(0, 255) };
  const digits = value.replace(/[^\d+]/g, "");
  const digitCount = digits.replace(/\D/g, "").length;
  if (digitCount >= 6 && digitCount <= 15 && /^[+\d][\d\s().-]*$/.test(value)) {
    return { phoneNumber: digits.slice(0, 20) };
  }
  return { membershipKey: value.slice(0, 255) };
}

export function mergeComoIdentifier(
  ...parts: Array<ComoIdentifier | null | undefined>
): ComoIdentifier {
  const out: ComoIdentifier = {};
  for (const part of parts) {
    if (!part) continue;
    if (part.phoneNumber && !out.phoneNumber) out.phoneNumber = part.phoneNumber;
    if (part.email && !out.email) out.email = part.email;
    if (part.membershipKey && !out.membershipKey) out.membershipKey = part.membershipKey;
  }
  return out;
}

export function hasComoIdentifier(id: ComoIdentifier): boolean {
  return !!(id.phoneNumber || id.email || id.membershipKey);
}

/** FAQ + webhook payloads: monetary values are the smallest currency unit. */
export function toComoMinorUnits(amountMajor: number): number {
  if (!Number.isFinite(amountMajor)) return 0;
  return Math.round(amountMajor * 100);
}

export function fromComoMinorUnits(amountMinor: unknown): number {
  const n = Number(amountMinor);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
}

export function buildComoPurchaseItems(lines: ComoCartLineInput[]): ComoPurchaseItem[] {
  return lines
    .map((line, index) => {
      const qty = Number(line.quantity);
      const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const itemCode = String(
        line.itemCode || line.sku || line.barcode || line.productId || `item-${index + 1}`
      ).trim();
      return {
        lineId: String(line.lineId || index + 1),
        itemCode: itemCode.slice(0, 128) || `item-${index + 1}`,
        quantity,
        price: toComoMinorUnits(Number(line.unitPrice) || 0),
      };
    })
    .filter((item) => item.itemCode);
}

export function buildComoPurchase(opts: {
  transactionId: string;
  posId?: string | null;
  orderType?: string | null;
  items: ComoCartLineInput[];
  totalMajor?: number;
}): ComoPurchase {
  const items = buildComoPurchaseItems(opts.items);
  const totalAmount =
    opts.totalMajor != null
      ? toComoMinorUnits(opts.totalMajor)
      : items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const purchase: ComoPurchase = {
    transactionId: String(opts.transactionId).slice(0, 128),
    items,
    totalAmount,
  };
  if (opts.posId) purchase.posId = String(opts.posId).slice(0, 64);
  if (opts.orderType) purchase.orderType = String(opts.orderType).slice(0, 64);
  return purchase;
}

export function buildComoCustomerBody(id: ComoIdentifier): Record<string, string> {
  const customer: Record<string, string> = {};
  if (id.phoneNumber) customer.phoneNumber = id.phoneNumber;
  if (id.email) customer.email = id.email;
  if (id.membershipKey) customer.membershipKey = id.membershipKey;
  return customer;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return undefined;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (value == null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickBool(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (value === true || value === false) return value;
    if (value === "true" || value === "Y" || value === "yes") return true;
    if (value === "false" || value === "N" || value === "no") return false;
  }
  return undefined;
}

export function isComoCustomerNotFound(errorText: string): boolean {
  return /customer not found|member not found|membership not found/i.test(errorText);
}

function parseAsset(raw: unknown): ComoAsset | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const key = pickString(obj.key, obj.Key, obj.assetKey, obj.AssetKey);
  if (!key) return null;
  const punches = pickNumber(obj.punches, obj.currentPunches, obj.punched, obj.used);
  const punchesRequired = pickNumber(
    obj.punchesRequired,
    obj.requiredPunches,
    obj.totalPunches,
    obj.maxPunches
  );
  return {
    key,
    name: pickString(obj.name, obj.Name, obj.assetName, obj.AssetName, obj.title),
    type: pickString(obj.type, obj.Type, obj.assetType, obj.AssetType),
    status: pickString(obj.status, obj.Status),
    redeemable: pickBool(obj.redeemable, obj.Redeemable, obj.redeemability),
    description: pickString(obj.description, obj.Description, obj.text, obj.Text),
    punches: punches,
    punchesRequired: punchesRequired,
    itemsSelection: obj.itemsSelection ?? obj.ItemsSelection,
  };
}

export function parseComoMember(payload: unknown): ComoMemberSnapshot {
  const root = asRecord(payload) || {};
  const membership = asRecord(root.membership) || asRecord(root.Membership) || root;
  const statusText = pickString(
    root.status,
    root.Status,
    root.error,
    root.Error,
    root.message,
    root.Message
  );
  const notFound = isComoCustomerNotFound(statusText || "");
  const assetsRaw =
    root.assets ||
    root.Assets ||
    membership.assets ||
    membership.Assets ||
    root.memberAssets ||
    root.MemberAssets ||
    [];
  const assets = Array.isArray(assetsRaw)
    ? assetsRaw.map(parseAsset).filter((a): a is ComoAsset => !!a)
    : [];
  return {
    membershipKey: pickString(
      membership.membershipKey,
      membership.MembershipKey,
      membership.key,
      membership.Key,
      root.membershipKey,
      root.MembershipKey
    ),
    firstName: pickString(membership.firstName, membership.FirstName),
    lastName: pickString(membership.lastName, membership.LastName),
    phoneNumber: pickString(membership.phoneNumber, membership.PhoneNumber),
    email: pickString(membership.email, membership.Email),
    pointsBalance: pickNumber(
      membership.pointsBalance,
      membership.Points,
      membership.points,
      root.pointsBalance
    ),
    creditBalance: pickNumber(
      membership.creditBalance,
      membership.BudgetWeighted,
      membership.credit,
      root.creditBalance
    ),
    usedByPayment: pickBool(membership.usedByPayment, root.usedByPayment) ?? null,
    notFound,
    assets,
  };
}

function parseDiscount(raw: unknown): ComoBenefitDiscount | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const amountMinor = pickNumber(
    obj.appliedAmount,
    obj.AppliedAmount,
    obj.amount,
    obj.Amount,
    obj.discountAmount,
    obj.DiscountAmount,
    obj.sum,
    obj.Sum
  );
  if (amountMinor == null || amountMinor === 0) return null;
  return {
    amountMinor: Math.abs(amountMinor),
    itemCode: pickString(obj.itemCode, obj.ItemCode),
    dealCode: pickString(obj.dealCode, obj.DealCode),
    lineId: pickString(obj.lineId, obj.LineID, obj.LineId),
    name: pickString(obj.name, obj.Name, obj.assetName, obj.AssetName, obj.text, obj.Text),
  };
}

export function parseComoBenefits(payload: unknown): {
  discounts: ComoBenefitDiscount[];
  totalDiscountMinor: number;
  deals: unknown[];
} {
  const root = asRecord(payload) || {};
  const lists = [
    root.discounts,
    root.Discounts,
    root.benefits,
    root.Benefits,
    root.deals,
    root.Deals,
    root.externalBenefits,
    root.ExternalBenefits,
  ];
  const discounts: ComoBenefitDiscount[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const parsed = parseDiscount(row);
      if (parsed) discounts.push(parsed);
    }
  }
  const totalDiscountMinor =
    pickNumber(root.totalDiscount, root.TotalDiscount, root.discountTotal) ??
    discounts.reduce((sum, d) => sum + d.amountMinor, 0);
  const deals = Array.isArray(root.deals)
    ? root.deals
    : Array.isArray(root.Deals)
      ? root.Deals
      : [];
  return { discounts, totalDiscountMinor: Math.abs(totalDiscountMinor), deals };
}

export function parseComoConfirmation(payload: unknown): {
  confirmation?: string;
  purchaseKey?: string;
  transactionId?: string;
} {
  const root = asRecord(payload) || {};
  const purchase = asRecord(root.purchase) || asRecord(root.Purchase) || {};
  return {
    confirmation: pickString(
      root.confirmation,
      root.Confirmation,
      purchase.confirmation,
      purchase.Confirmation,
      root.purchaseConfirmation
    ),
    purchaseKey: pickString(
      root.purchaseKey,
      root.PurchaseKey,
      purchase.purchaseKey,
      purchase.PurchaseKey
    ),
    transactionId: pickString(
      root.transactionId,
      root.TransactionID,
      root.TransactionId,
      purchase.transactionId,
      purchase.TransactionID
    ),
  };
}

export function sanitizeComoError(text: string): string {
  return String(text || "")
    .replace(/x-api-key\s*[:=]\s*\S+/gi, "X-Api-Key: [redacted]")
    .replace(/api[_-]?key["']?\s*[:=]\s*["']?[^"'\s]+/gi, "apiKey=[redacted]")
    .slice(0, 400);
}
