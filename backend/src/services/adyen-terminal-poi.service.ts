import axios from "axios";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  parsePaymentReceipts,
  type AdyenTerminalReceipt,
} from "@/lib/adyen-receipt";
import { AdyenService } from "@/services/adyen.service";

export type TerminalPoiResult = {
  status: "approved" | "declined" | "cancelled" | "error";
  message?: string;
  reference?: string | null;
  poiTransactionTimestamp?: string | null;
  customerReceipt?: AdyenTerminalReceipt | null;
  cashierReceipt?: AdyenTerminalReceipt | null;
};

type AdyenApiError = {
  errorCode?: string;
  detail?: string;
  requestId?: string;
  title?: string;
};

type TerminalContext = {
  apiKey: string;
  merchantAccount: string;
  terminalId: string;
  saleId: string;
  live: boolean;
  region: string;
  useLegacy: boolean;
  currency: string;
};

const REFUSAL_MESSAGES: Record<string, string> = {
  NOT_ENOUGH_BALANCE: "Insufficient funds",
  INSUFFICIENT_BALANCE: "Insufficient funds",
  NOT_SUPPORTED: "Card not supported",
  REFUSED: "Card declined",
  DECLINED: "Card declined",
  CANCELLED: "Payment cancelled",
  CANCELED: "Payment cancelled",
  INVALID_CARD: "Invalid card",
  EXPIRED_CARD: "Card expired",
  CVC_DECLINED: "Security code declined",
  WITHDRAWAL_AMOUNT_EXCEEDED: "Withdrawal limit exceeded",
  RESTRICTED_CARD: "Card restricted",
  PIN_TRIES_EXCEEDED: "PIN tries exceeded",
  BLOCKED_CARD: "Card blocked",
  FRAUD: "Payment declined",
  ISSUER_SUSPECTED_FRAUD: "Payment declined by issuer",
  SHOPPER_CANCELLED: "Payment cancelled on terminal",
  SHOPPER_CANCELED: "Payment cancelled on terminal",
};

const ERROR_CONDITION_MESSAGES: Record<string, string> = {
  Cancel: "Payment cancelled on terminal",
  Refusal: "Card declined",
  NotAllowed: "Payment not allowed",
  DeviceOut: "Terminal unavailable",
  UnavailableDevice: "Terminal unavailable",
  UnreachableHost: "Could not reach payment host",
  WrongPIN: "Incorrect PIN",
  InvalidCard: "Invalid card",
  NotEnoughBalance: "Insufficient funds",
};

/** Parse Adyen AdditionalResponse query string into a friendly customer message. */
export function friendlyTerminalPaymentMessage(
  errorCondition?: string | null,
  additionalResponse?: string | null
): string {
  const params = new URLSearchParams();
  if (additionalResponse) {
    try {
      const decoded = decodeURIComponent(String(additionalResponse).replace(/\+/g, " "));
      for (const part of decoded.split("&")) {
        const [k, ...rest] = part.split("=");
        if (k) params.set(k.trim(), rest.join("=").trim());
      }
    } catch {
      /* ignore malformed */
    }
  }

  const refusal =
    params.get("refusalReason") ||
    params.get("message") ||
    params.get("status") ||
    "";
  const refusalKey = refusal.trim().toUpperCase().replace(/\s+/g, "_");
  if (refusalKey && REFUSAL_MESSAGES[refusalKey]) {
    return REFUSAL_MESSAGES[refusalKey]!;
  }
  if (/not.?enough|insufficient/i.test(refusal)) return "Insufficient funds";
  if (/declin|refus/i.test(refusal)) return "Card declined";
  if (/cancel/i.test(refusal)) return "Payment cancelled on terminal";

  const cond = String(errorCondition || "").trim();
  if (cond && ERROR_CONDITION_MESSAGES[cond]) {
    return ERROR_CONDITION_MESSAGES[cond]!;
  }
  if (/cancel/i.test(cond)) return "Payment cancelled on terminal";
  if (/refusal|declin/i.test(cond)) return "Card declined";
  if (/notenough|balance/i.test(cond)) return "Insufficient funds";

  if (refusal && refusal.length <= 80 && !refusal.includes("=")) {
    return refusal.replace(/_/g, " ");
  }
  if (cond) return `Payment failed (${cond})`;
  return "Payment declined";
}

function cloudDeviceHost(live: boolean, region: string): string {
  if (!live) return "device-api-test.adyen.com";
  switch (String(region || "EU").toUpperCase()) {
    case "US":
      return "device-api-live-us.adyen.com";
    case "AU":
      return "device-api-live-au.adyen.com";
    case "APSE":
      return "device-api-live-apse.adyen.com";
    default:
      return "device-api-live.adyen.com";
  }
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, "/");
}

function cloudDeviceSyncUrl(
  live: boolean,
  region: string,
  merchantAccount: string,
  terminalId: string
): string {
  const host = cloudDeviceHost(live, region);
  return `https://${host}/v1/merchants/${encodePathSegment(merchantAccount)}/devices/${encodePathSegment(terminalId)}/sync`;
}

function legacySyncUrl(live: boolean): string {
  return live
    ? "https://terminal-api-live.adyen.com/sync"
    : "https://terminal-api-test.adyen.com/sync";
}

function generateServiceId(): string {
  return String(Date.now() % 10_000_000_000).padStart(10, "0");
}

function buildPaymentRequestBody(
  amount: number,
  currencyCode: string,
  saleId: string,
  poiId: string
): Record<string, unknown> {
  const serviceId = generateServiceId();
  const transactionId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const timestamp = new Date().toISOString();
  const requestedAmount = Math.round(amount * 100) / 100;

  return {
    SaleToPOIRequest: {
      MessageHeader: {
        ProtocolVersion: "3.0",
        MessageClass: "Service",
        MessageCategory: "Payment",
        MessageType: "Request",
        ServiceID: serviceId,
        SaleID: saleId,
        POIID: poiId,
      },
      PaymentRequest: {
        SaleData: {
          SaleTransactionID: {
            TransactionID: transactionId,
            TimeStamp: timestamp,
          },
          SaleToAcquirerData: "tenderOption=ReceiptHandler",
        },
        PaymentTransaction: {
          AmountsReq: {
            Currency: currencyCode.toUpperCase(),
            RequestedAmount: requestedAmount,
          },
        },
      },
    },
  };
}

function buildReversalRequestBody(
  amount: number,
  currencyCode: string,
  saleId: string,
  poiId: string,
  originalTransactionId: string,
  originalTimestamp: string
): Record<string, unknown> {
  const serviceId = generateServiceId();
  const requestedAmount = Math.round(amount * 100) / 100;

  return {
    SaleToPOIRequest: {
      MessageHeader: {
        ProtocolVersion: "3.0",
        MessageClass: "Service",
        MessageCategory: "Reversal",
        MessageType: "Request",
        ServiceID: serviceId,
        SaleID: saleId,
        POIID: poiId,
      },
      ReversalRequest: {
        OriginalPOITransaction: {
          POITransactionID: {
            TransactionID: originalTransactionId,
            TimeStamp: originalTimestamp,
          },
        },
        ReversalReason: "MerchantCancel",
        ReversedAmount: requestedAmount,
        PaymentData: {
          PaymentType: "Normal",
        },
        SaleData: {
          SaleTransactionID: {
            TransactionID: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
            TimeStamp: new Date().toISOString(),
          },
        },
        PaymentTransaction: {
          AmountsReq: {
            Currency: currencyCode.toUpperCase(),
            RequestedAmount: requestedAmount,
          },
        },
      },
    },
  };
}

function buildUnreferencedRefundRequestBody(
  amount: number,
  currencyCode: string,
  saleId: string,
  poiId: string
): Record<string, unknown> {
  const serviceId = generateServiceId();
  const requestedAmount = Math.round(amount * 100) / 100;

  return {
    SaleToPOIRequest: {
      MessageHeader: {
        ProtocolVersion: "3.0",
        MessageClass: "Service",
        MessageCategory: "Payment",
        MessageType: "Request",
        ServiceID: serviceId,
        SaleID: saleId,
        POIID: poiId,
      },
      PaymentRequest: {
        SaleData: {
          SaleTransactionID: {
            TransactionID: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
            TimeStamp: new Date().toISOString(),
          },
        },
        PaymentData: {
          PaymentType: "Refund",
        },
        PaymentTransaction: {
          AmountsReq: {
            Currency: currencyCode.toUpperCase(),
            RequestedAmount: requestedAmount,
          },
        },
      },
    },
  };
}

function parseAdyenApiError(body: string): AdyenApiError | null {
  if (!body?.trim()) return null;
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    return {
      errorCode: typeof json.errorCode === "string" ? json.errorCode : undefined,
      detail:
        (typeof json.detail === "string" ? json.detail : undefined) ||
        (typeof json.message === "string" ? json.message : undefined),
      requestId: typeof json.requestId === "string" ? json.requestId : undefined,
      title: typeof json.title === "string" ? json.title : undefined,
    };
  } catch {
    return null;
  }
}

function formatHttpError(code: number, apiError: AdyenApiError | null, triedLegacy: boolean): string {
  if (apiError?.errorCode === "00_403") {
    return [
      "Adyen permission denied (00_403). Check Cloud Device API role on your Web service API key.",
      triedLegacy
        ? "Legacy Terminal API also returned 00_403."
        : 'Try enabling "Use legacy Terminal API" in merchant settings.',
      apiError.detail ? `Adyen: ${apiError.detail}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  const detail = apiError?.detail || apiError?.title;
  switch (code) {
    case 401:
      return detail || "Invalid Adyen API key.";
    case 403:
      return detail || "Adyen rejected the request (403).";
    case 404:
      return "Terminal or merchant not found. Check merchant account and terminal POIID.";
    case 422:
      return detail || "Invalid payment request sent to Adyen terminal.";
    default:
      return detail || `Adyen terminal request failed (HTTP ${code}).`;
  }
}

function shouldRetryLegacy(message: string): boolean {
  return (
    /HTTP 404/i.test(message) ||
    /00_403/i.test(message) ||
    /HTTP 403/i.test(message)
  );
}

function extractPoiTransactionId(paymentResponse: Record<string, unknown>): {
  transactionId: string | null;
  timestamp: string | null;
} {
  const poiData = paymentResponse.POIData as Record<string, unknown> | undefined;
  const poiTx = poiData?.POITransactionID as Record<string, unknown> | undefined;
  const transactionId =
    typeof poiTx?.TransactionID === "string" ? poiTx.TransactionID : null;
  const timestamp = typeof poiTx?.TimeStamp === "string" ? poiTx.TimeStamp : null;
  return { transactionId, timestamp };
}

function parsePaymentResponse(body: string): TerminalPoiResult {
  if (!body?.trim()) {
    return { status: "error", message: "Empty response from Adyen terminal." };
  }

  try {
    const root = JSON.parse(body) as Record<string, unknown>;
    const paymentResponse = (root.SaleToPOIResponse as Record<string, unknown> | undefined)
      ?.PaymentResponse as Record<string, unknown> | undefined;
    if (!paymentResponse) {
      return { status: "error", message: "Unexpected Adyen response format." };
    }

    const responseNode = paymentResponse.Response as Record<string, unknown> | undefined;
    if (!responseNode) {
      return { status: "error", message: "Missing payment response from terminal." };
    }

    const result = String(responseNode.Result || "");
    const errorCondition =
      typeof responseNode.ErrorCondition === "string" ? responseNode.ErrorCondition : undefined;
    const additionalResponse =
      typeof responseNode.AdditionalResponse === "string"
        ? responseNode.AdditionalResponse
        : undefined;

    if (result.toLowerCase() === "success") {
      const { transactionId, timestamp } = extractPoiTransactionId(paymentResponse);
      const { customer, cashier } = parsePaymentReceipts(paymentResponse);
      return {
        status: "approved",
        reference: transactionId,
        poiTransactionTimestamp: timestamp,
        customerReceipt: customer,
        cashierReceipt: cashier,
      };
    }

    if (
      result.toLowerCase() === "failure" &&
      errorCondition?.toLowerCase() === "cancel"
    ) {
      return {
        status: "cancelled",
        message: friendlyTerminalPaymentMessage(errorCondition, additionalResponse),
      };
    }

    return {
      status: "declined",
      message: friendlyTerminalPaymentMessage(errorCondition, additionalResponse),
    };
  } catch {
    return { status: "error", message: "Could not parse Adyen terminal response." };
  }
}

function parseReversalResponse(body: string): TerminalPoiResult {
  if (!body?.trim()) {
    return { status: "error", message: "Empty response from Adyen terminal." };
  }

  try {
    const root = JSON.parse(body) as Record<string, unknown>;
    const reversalResponse = (root.SaleToPOIResponse as Record<string, unknown> | undefined)
      ?.ReversalResponse as Record<string, unknown> | undefined;
    if (!reversalResponse) {
      return { status: "error", message: "Unexpected Adyen reversal response format." };
    }

    const responseNode = reversalResponse.Response as Record<string, unknown> | undefined;
    if (!responseNode) {
      return { status: "error", message: "Missing reversal response from terminal." };
    }

    const result = String(responseNode.Result || "");
    const errorCondition =
      typeof responseNode.ErrorCondition === "string" ? responseNode.ErrorCondition : undefined;
    const additionalResponse =
      typeof responseNode.AdditionalResponse === "string"
        ? responseNode.AdditionalResponse
        : undefined;

    if (result.toLowerCase() === "success") {
      const { transactionId, timestamp } = extractPoiTransactionId(reversalResponse);
      const { customer, cashier } = parsePaymentReceipts(reversalResponse);
      return {
        status: "approved",
        reference: transactionId,
        poiTransactionTimestamp: timestamp,
        customerReceipt: customer,
        cashierReceipt: cashier,
      };
    }

    if (
      result.toLowerCase() === "failure" &&
      errorCondition?.toLowerCase() === "cancel"
    ) {
      return {
        status: "cancelled",
        message: friendlyTerminalPaymentMessage(errorCondition, additionalResponse),
      };
    }

    return {
      status: "declined",
      message: friendlyTerminalPaymentMessage(errorCondition, additionalResponse),
    };
  } catch {
    return { status: "error", message: "Could not parse Adyen reversal response." };
  }
}

async function postSync(
  apiKey: string,
  url: string,
  body: Record<string, unknown>,
  triedLegacy: boolean,
  parseFn: (body: string) => TerminalPoiResult = parsePaymentResponse
): Promise<TerminalPoiResult> {
  try {
    const response = await axios.post(url, body, {
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 165_000,
      validateStatus: () => true,
    });

    const responseBody =
      typeof response.data === "string" ? response.data : JSON.stringify(response.data ?? "");

    if (response.status < 200 || response.status >= 300) {
      const apiError = parseAdyenApiError(responseBody);
      return {
        status: "error",
        message: formatHttpError(response.status, apiError, triedLegacy),
      };
    }

    return parseFn(responseBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not reach Adyen";
    return { status: "error", message: `Network error: ${msg}` };
  }
}

function looksLikeClientKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    trimmed.startsWith("live_") ||
    trimmed.startsWith("test_") ||
    trimmed.startsWith("pub_")
  );
}

async function resolveTerminalContext(
  merchantId: string,
  opts: { terminalId?: string; currency?: string } = {}
): Promise<TerminalContext | TerminalPoiResult> {
  const creds = await AdyenService.resolveCredentials(merchantId, opts.terminalId);
  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
  });

  const apiKey = creds.apiKey?.trim() || "";
  const merchantAccount = creds.merchantAccount?.trim() || "";
  const terminalId = String(creds.terminalId || opts.terminalId || "").trim();
  const saleId = creds.clientId?.trim() || "ChaslayWebPOS";
  const live = !!merchant?.adyenLiveEnvironment;
  const region = merchant?.adyenLiveRegion || "EU";
  const useLegacy = !!merchant?.adyenUseLegacyEndpoint;
  const currency = String(opts.currency || "CHF").toUpperCase();

  if (!apiKey) return { status: "error", message: "Adyen API key not configured" };
  if (!merchantAccount) return { status: "error", message: "Adyen merchant account not configured" };
  if (!terminalId) {
    return {
      status: "error",
      message: "Adyen terminal ID not configured (POIID, e.g. V400m-324688179)",
    };
  }
  if (looksLikeClientKey(apiKey)) {
    return {
      status: "error",
      message:
        "This looks like an Adyen client key, not a Web service API key. Use a Web service API key with the Cloud Device API role.",
    };
  }

  return {
    apiKey,
    merchantAccount,
    terminalId,
    saleId,
    live,
    region,
    useLegacy,
    currency,
  };
}

async function executeSync(
  ctx: TerminalContext,
  body: Record<string, unknown>,
  parseFn: (body: string) => TerminalPoiResult
): Promise<TerminalPoiResult> {
  if (ctx.useLegacy) {
    return postSync(ctx.apiKey, legacySyncUrl(ctx.live), body, true, parseFn);
  }

  const cloudUrl = cloudDeviceSyncUrl(
    ctx.live,
    ctx.region,
    ctx.merchantAccount,
    ctx.terminalId
  );
  const cloudResult = await postSync(ctx.apiKey, cloudUrl, body, false, parseFn);
  if (cloudResult.status === "error" && shouldRetryLegacy(cloudResult.message || "")) {
    return postSync(ctx.apiKey, legacySyncUrl(ctx.live), body, true, parseFn);
  }
  return cloudResult;
}

export class AdyenTerminalPoiService {
  static async processTerminalPayment(
    merchantId: string,
    amount: number,
    opts: { terminalId?: string; currency?: string } = {}
  ): Promise<TerminalPoiResult> {
    const ctxOrErr = await resolveTerminalContext(merchantId, opts);
    if ("status" in ctxOrErr) return ctxOrErr;

    const body = buildPaymentRequestBody(
      amount,
      ctxOrErr.currency,
      ctxOrErr.saleId,
      ctxOrErr.terminalId
    );
    return executeSync(ctxOrErr, body, parsePaymentResponse);
  }

  /**
   * Referenced POI refund (ReversalRequest) ù returns funds to the customer's bank card.
   * Supports partial and full refunds when original POI transaction id + timestamp are known.
   */
  static async processTerminalRefund(
    merchantId: string,
    amount: number,
    opts: {
      terminalId?: string;
      currency?: string;
      originalPoiTransactionId: string;
      originalPoiTransactionTimestamp: string;
    }
  ): Promise<TerminalPoiResult> {
    const ctxOrErr = await resolveTerminalContext(merchantId, opts);
    if ("status" in ctxOrErr) return ctxOrErr;

    const originalId = String(opts.originalPoiTransactionId || "").trim();
    const originalTs = String(opts.originalPoiTransactionTimestamp || "").trim();
    if (!originalId || !originalTs) {
      return {
        status: "error",
        message: "Original Adyen POI transaction reference is missing for card refund.",
      };
    }

    const body = buildReversalRequestBody(
      amount,
      ctxOrErr.currency,
      ctxOrErr.saleId,
      ctxOrErr.terminalId,
      originalId,
      originalTs
    );
    return executeSync(ctxOrErr, body, parseReversalResponse);
  }

  /**
   * Unreferenced POI refund (PaymentRequest PaymentType=Refund) ó goodwill compensation
   * not linked to an original terminal transaction.
   */
  static async processUnreferencedTerminalRefund(
    merchantId: string,
    amount: number,
    opts: { terminalId?: string; currency?: string } = {}
  ): Promise<TerminalPoiResult> {
    const ctxOrErr = await resolveTerminalContext(merchantId, opts);
    if ("status" in ctxOrErr) return ctxOrErr;

    if (!Number.isFinite(amount) || amount <= 0) {
      return { status: "error", message: "Valid compensation amount is required" };
    }

    const body = buildUnreferencedRefundRequestBody(
      amount,
      ctxOrErr.currency,
      ctxOrErr.saleId,
      ctxOrErr.terminalId
    );
    return executeSync(ctxOrErr, body, parsePaymentResponse);
  }
}
