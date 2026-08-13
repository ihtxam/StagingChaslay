/** Parse Adyen Terminal API PaymentReceipt OutputText into plain thermal lines. */

export type AdyenReceiptLine = {
  text: string;
  bold?: boolean;
  centered?: boolean;
  endOfLine?: boolean;
};

export type AdyenTerminalReceipt = {
  documentQualifier: string;
  lines: AdyenReceiptLine[];
};

function urlDecode(value: string): string {
  try {
    return decodeURIComponent(String(value).replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function leftRight(left: string, right: string, width: number): string {
  const leftText = left.slice(0, width - right.length - 1);
  const padding = Math.max(1, width - leftText.length - right.length);
  return leftText + " ".repeat(padding) + right;
}

function renderLine(rawText: string, width: number): string {
  const decoded = urlDecode(rawText);
  if (!decoded.includes("=")) return decoded;

  const params = new URLSearchParams();
  for (const part of decoded.split("&")) {
    const [k, ...rest] = part.split("=");
    if (k) params.set(k.trim(), urlDecode(rest.join("=").trim()));
  }

  const key = (params.get("key") || "").toLowerCase();
  const name = params.get("name") || "";
  const value = params.get("value") || "";

  switch (key) {
    case "filler":
    case "signature":
      return "";
    case "sigline":
    case "merchantsigline":
      return "_".repeat(Math.min(28, width));
    case "header1":
    case "header2":
    case "thanks":
    case "approved":
    case "refused":
    case "void":
    case "cardholderheader":
      return value || name;
    default:
      if (name && value) return leftRight(name, value, width);
      return name || value || "";
  }
}

function parseOutputText(
  outputText: Array<Record<string, unknown>>
): AdyenReceiptLine[] {
  const lines: AdyenReceiptLine[] = [];
  for (const obj of outputText) {
    const rawText = String(obj.Text || "");
    const bold = String(obj.CharacterStyle || "").toLowerCase() === "bold";
    const alignment = String(obj.Alignment || "");
    const centered =
      /cent(er|re)/i.test(alignment) || alignment.toLowerCase() === "right";
    const endOfLine = obj.EndOfLineFlag !== false;
    lines.push({
      text: renderLine(rawText, 32),
      bold,
      centered,
      endOfLine,
    });
  }
  return lines;
}

export function parsePaymentReceipts(
  paymentResponse: Record<string, unknown>
): { customer: AdyenTerminalReceipt | null; cashier: AdyenTerminalReceipt | null } {
  const receipts = paymentResponse.PaymentReceipt;
  if (!Array.isArray(receipts)) return { customer: null, cashier: null };

  let customer: AdyenTerminalReceipt | null = null;
  let cashier: AdyenTerminalReceipt | null = null;

  for (const element of receipts) {
    const receipt = element as Record<string, unknown>;
    const qualifier = String(receipt.DocumentQualifier || "");
    const outputContent = receipt.OutputContent as Record<string, unknown> | undefined;
    const outputText = outputContent?.OutputText;
    if (!Array.isArray(outputText)) continue;

    const parsed: AdyenTerminalReceipt = {
      documentQualifier: qualifier,
      lines: parseOutputText(outputText as Array<Record<string, unknown>>),
    };

    if (/customerreceipt/i.test(qualifier)) customer = parsed;
    else if (/cashierreceipt/i.test(qualifier)) cashier = parsed;
  }

  return { customer, cashier };
}

function center(text: string, width: number): string {
  if (text.length >= width) return text;
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(Math.max(0, pad)) + text;
}

export function adyenReceiptToPlainText(
  receipt: AdyenTerminalReceipt,
  lineWidth = 32
): string {
  let out = "";
  let pending = "";
  for (const line of receipt.lines) {
    let segment = line.text;
    if (line.centered) segment = center(segment, lineWidth);
    else if (line.bold) segment = segment.toUpperCase();

    if (line.endOfLine !== false) {
      out += pending + segment + "\n";
      pending = "";
    } else {
      pending += segment;
    }
  }
  if (pending) out += pending + "\n";
  return out + "\n";
}

export function appendAdyenReceiptBlock(
  receiptText: string,
  receipt: AdyenTerminalReceipt | null | undefined,
  lineWidth = 32
): string {
  if (!receipt?.lines?.length) return receiptText;
  const thin = "-".repeat(Math.min(lineWidth, 32));
  return (
    receiptText +
    thin +
    "\n" +
    adyenReceiptToPlainText(receipt, lineWidth)
  );
}

export function parseAdyenReceiptJson(json?: string | null): AdyenTerminalReceipt | null {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json) as AdyenTerminalReceipt;
    return Array.isArray(parsed?.lines) && parsed.lines.length ? parsed : null;
  } catch {
    return null;
  }
}
