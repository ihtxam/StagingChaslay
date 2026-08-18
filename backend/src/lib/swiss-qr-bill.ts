/**
 * SIX Swiss QR-bill (QR-Rechnung) helpers.
 *
 * Generates an SPC (Swiss Payments Code) payload per Implementation Guidelines
 * for the QR-bill, version 2.2 / 0200. This is not a SIX-certified renderer —
 * print measurements and the Swiss-cross overlay follow the spec closely but
 * banks may still require official certification for production QR-bills.
 */

const SPC_CRLF = "\r\n";

export type QrAddressType = "K" | "S";

export type QrAddress = {
  type: QrAddressType;
  name: string;
  /** K: address line 1; S: street */
  line1: string;
  /** K: address line 2 (zip + city); S: building number */
  line2: string;
  postalCode: string;
  town: string;
  country: string;
};

export type SwissQrBillInput = {
  iban: string;
  amount: number;
  currency?: string;
  creditor: QrAddress;
  debtor?: QrAddress | null;
  /** QRR (QR-IBAN) | SCOR | NON */
  referenceType?: "QRR" | "SCOR" | "NON";
  reference?: string;
  unstructuredMessage?: string;
  billingInfo?: string;
};

/** Modulo-10 recursive check digit used by Swiss QRR references. */
export function mod10Recursive(digits: string): number {
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const ch of digits) {
    const n = Number(ch);
    if (!Number.isInteger(n)) continue;
    carry = table[(carry + n) % 10];
  }
  return (10 - carry) % 10;
}

/** 27-digit QRR reference from a numeric sequence (invoice number). */
export function buildQrrReference(sequence: number): string {
  const body = String(Math.max(0, Math.floor(sequence))).padStart(26, "0").slice(-26);
  return `${body}${mod10Recursive(body)}`;
}

export function stripIban(raw: string): string {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isLikelyQrIban(iban: string): boolean {
  const clean = stripIban(iban);
  // Swiss QR-IBAN: institution identification in 30000–31999 range (positions 5–9).
  if (!clean.startsWith("CH") && !clean.startsWith("LI")) return false;
  const iid = Number(clean.slice(4, 9));
  return Number.isFinite(iid) && iid >= 30000 && iid <= 31999;
}

function clip(value: string | undefined, max: number): string {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

function addressLines(addr: QrAddress): string[] {
  if (addr.type === "S") {
    return [
      "S",
      clip(addr.name, 70),
      clip(addr.line1, 70),
      clip(addr.line2, 16),
      clip(addr.postalCode, 16),
      clip(addr.town, 35),
      clip(addr.country || "CH", 2).toUpperCase() || "CH",
    ];
  }
  return [
    "K",
    clip(addr.name, 70),
    clip(addr.line1, 70),
    clip(addr.line2, 70),
    "",
    "",
    clip(addr.country || "CH", 2).toUpperCase() || "CH",
  ];
}

function emptyAddress(): string[] {
  return ["", "", "", "", "", "", ""];
}

/**
 * Build the SPC payload string (CRLF-separated) for a Swiss QR-bill.
 */
export function buildSwissQrPayload(input: SwissQrBillInput): string {
  const iban = stripIban(input.iban);
  const currency = (input.currency || "CHF").toUpperCase().slice(0, 3);
  const amount = Number(input.amount);
  const amountStr =
    Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "";

  let refType = input.referenceType || "NON";
  let reference = clip(input.reference, 27);
  if (isLikelyQrIban(iban)) {
    refType = "QRR";
    if (!/^\d{27}$/.test(reference)) {
      throw new Error("QR-IBAN requires a 27-digit QRR reference");
    }
  } else if (refType === "QRR") {
    refType = reference ? "SCOR" : "NON";
  }
  if (refType === "NON") reference = "";
  if (refType === "SCOR") reference = clip(input.reference, 25);

  const lines: string[] = [
    "SPC",
    "0200",
    "1",
    iban,
    ...addressLines(input.creditor),
    ...emptyAddress(),
    amountStr,
    currency,
    ...(input.debtor ? addressLines(input.debtor) : emptyAddress()),
    refType,
    reference,
    clip(input.unstructuredMessage, 140),
    "EPD",
  ];
  if (input.billingInfo) {
    lines.push(clip(input.billingInfo, 140));
  }
  return lines.join(SPC_CRLF);
}

export function parseAddressFromMerchant(opts: {
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
}): QrAddress {
  const street = String(opts.address || "").trim();
  const city = String(opts.city || "").trim();
  const country = String(opts.country || "CH").trim().slice(0, 2).toUpperCase() || "CH";
  const zipMatch = street.match(/\b(\d{4,5})\b/);
  const postal = zipMatch?.[1] || "";
  const town = city || street.replace(/\b\d{4,5}\b/, "").replace(/^[,\s]+|[,\s]+$/g, "");
  return {
    type: "K",
    name: clip(opts.name, 70) || "Merchant",
    line1: clip(street, 70),
    line2: clip([postal, town].filter(Boolean).join(" "), 70),
    postalCode: postal,
    town: town.slice(0, 35),
    country,
  };
}

export function parseAddressFromCustomer(opts: {
  name?: string | null;
  address?: string | null;
  city?: string | null;
}): QrAddress | null {
  const name = clip(opts.name || "", 70);
  if (!name) return null;
  const street = String(opts.address || "").trim();
  const city = String(opts.city || "").trim();
  return {
    type: "K",
    name,
    line1: clip(street, 70),
    line2: clip(city, 70),
    postalCode: "",
    town: city.slice(0, 35),
    country: "CH",
  };
}
