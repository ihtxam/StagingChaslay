export type SplitPaymentFlag = boolean;

export type ParsedEventNotification = {
  eventToNotify: string;
  eventDetails: string | null;
  poiId: string | null;
  saleId: string | null;
};

export type SplitPaymentParseResult = {
  status: "success" | "partial" | "failure" | "cancelled" | "pay_later" | "error";
  message?: string;
  authorizedAmount?: number;
  saleTransactionId?: string | null;
  saleTransactionTimestamp?: string | null;
  poiTransactionId?: string | null;
  poiTransactionTimestamp?: string | null;
  paymentInstrumentType?: string | null;
};

function generateServiceId(): string {
  return String(Date.now() % 10_000_000_000).padStart(10, "0");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function encodeDisplayXhtml(text: string): string {
  const xhtml = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>${escapeXml(text)}</p></body></html>`;
  return Buffer.from(xhtml, "utf8").toString("base64");
}

export function buildSplitPaymentRequestBody(opts: {
  amount: number;
  paidAmount: number;
  currency: string;
  saleId: string;
  poiId: string;
  saleTransactionId: string;
  saleTransactionTimestamp: string;
  splitPaymentFlag?: SplitPaymentFlag;
}): Record<string, unknown> {
  const serviceId = generateServiceId();
  const requestedAmount = Math.round(Math.max(0, opts.amount) * 100) / 100;
  const paidAmount = Math.round(Math.max(0, opts.paidAmount) * 100) / 100;

  return {
    SaleToPOIRequest: {
      MessageHeader: {
        ProtocolVersion: "3.0",
        MessageClass: "Service",
        MessageCategory: "Payment",
        MessageType: "Request",
        ServiceID: serviceId,
        SaleID: opts.saleId,
        POIID: opts.poiId,
      },
      PaymentRequest: {
        SaleData: {
          SaleTransactionID: {
            TransactionID: opts.saleTransactionId,
            TimeStamp: opts.saleTransactionTimestamp,
          },
          SaleToAcquirerData: "tenderOption=ReceiptHandler",
        },
        PaymentData: {
          PaymentType: "Normal",
          SplitPaymentFlag: opts.splitPaymentFlag !== false,
        },
        PaymentTransaction: {
          AmountsReq: {
            Currency: opts.currency.toUpperCase(),
            RequestedAmount: requestedAmount,
            PaidAmount: paidAmount,
          },
        },
      },
    },
  };
}

export function buildInputTextRequestBody(opts: {
  saleId: string;
  poiId: string;
  prompt: string;
  placeholder?: string;
  maxInputTime?: number;
}): Record<string, unknown> {
  const serviceId = generateServiceId();
  return {
    SaleToPOIRequest: {
      MessageHeader: {
        ProtocolVersion: "3.0",
        MessageClass: "Device",
        MessageCategory: "Input",
        MessageType: "Request",
        ServiceID: serviceId,
        SaleID: opts.saleId,
        POIID: opts.poiId,
      },
      InputRequest: {
        DisplayOutput: {
          Device: "CustomerDisplay",
          InfoQualify: "Display",
          OutputContent: {
            OutputFormat: "Text",
            PredefinedContent: { ReferenceID: "GetText" },
            OutputText: [{ Text: opts.prompt }],
          },
        },
        InputData: {
          Device: "CustomerInput",
          InfoQualify: "Input",
          InputCommand: "TextString",
          MaxInputTime: opts.maxInputTime ?? 120,
          ...(opts.placeholder ? { DefaultInputString: opts.placeholder } : {}),
        },
      },
    },
  };
}

export function buildInputMenuRequestBody(opts: {
  saleId: string;
  poiId: string;
  title: string;
  subtitle?: string;
  entries: Array<{ label: string; sublabel?: string }>;
  maxInputTime?: number;
}): Record<string, unknown> {
  const serviceId = generateServiceId();
  const menuEntry = opts.entries.slice(0, 15).map((entry) => ({
    OutputFormat: "Text",
    OutputText: entry.sublabel
      ? [{ Text: entry.label }, { Text: entry.sublabel }]
      : [{ Text: entry.label }],
  }));

  const outputText = [{ Text: opts.title }];
  if (opts.subtitle) outputText.push({ Text: opts.subtitle });

  return {
    SaleToPOIRequest: {
      MessageHeader: {
        ProtocolVersion: "3.0",
        MessageClass: "Device",
        MessageCategory: "Input",
        MessageType: "Request",
        ServiceID: serviceId,
        SaleID: opts.saleId,
        POIID: opts.poiId,
      },
      InputRequest: {
        DisplayOutput: {
          Device: "CustomerDisplay",
          InfoQualify: "Display",
          OutputContent: {
            OutputFormat: "Text",
            PredefinedContent: { ReferenceID: "MenuButtons" },
            OutputText: outputText,
          },
          MenuEntry: menuEntry,
        },
        InputData: {
          Device: "CustomerInput",
          InfoQualify: "Input",
          InputCommand: "GetMenuEntry",
          MaxInputTime: opts.maxInputTime ?? 120,
        },
      },
    },
  };
}

export function buildDisplayMessageRequestBody(opts: {
  saleId: string;
  poiId: string;
  message: string;
}): Record<string, unknown> {
  const serviceId = generateServiceId();
  const outputXhtmlBase64 = encodeDisplayXhtml(opts.message);
  return {
    SaleToPOIRequest: {
      MessageHeader: {
        ProtocolVersion: "3.0",
        MessageClass: "Device",
        MessageCategory: "Display",
        MessageType: "Request",
        ServiceID: serviceId,
        SaleID: opts.saleId,
        POIID: opts.poiId,
      },
      DisplayRequest: {
        DisplayOutput: [
          {
            Device: "CustomerDisplay",
            InfoQualify: "Display",
            OutputContent: {
              OutputFormat: "XHTML",
              OutputXHTML: outputXhtmlBase64,
            },
          },
        ],
      },
    },
  };
}

export function parseEventNotification(body: unknown): ParsedEventNotification | null {
  const root = normalizeRoot(body);
  if (!root) return null;

  const request = root.SaleToPOIRequest as Record<string, unknown> | undefined;
  const header = request?.MessageHeader as Record<string, unknown> | undefined;
  const event = request?.EventNotification as Record<string, unknown> | undefined;
  if (!event) return null;

  const eventToNotify = String(event.EventToNotify || event.eventToNotify || "").trim();
  const eventDetailsRaw = event.EventDetails ?? event.eventDetails;
  const eventDetails =
    eventDetailsRaw != null && String(eventDetailsRaw).trim()
      ? String(eventDetailsRaw).trim()
      : null;

  return {
    eventToNotify,
    eventDetails,
    poiId: typeof header?.POIID === "string" ? header.POIID : null,
    saleId: typeof header?.SaleID === "string" ? header.SaleID : null,
  };
}

export function parseInputResponse(body: unknown): {
  textInput?: string | null;
  menuEntryNumber?: number | null;
  poiId?: string | null;
  saleId?: string | null;
} | null {
  const root = normalizeRoot(body);
  if (!root) return null;

  const response = root.SaleToPOIResponse as Record<string, unknown> | undefined;
  const header = response?.MessageHeader as Record<string, unknown> | undefined;
  const inputResponse = response?.InputResponse as Record<string, unknown> | undefined;
  if (!inputResponse) return null;

  const input = inputResponse.Input as Record<string, unknown> | undefined;
  const textInput = typeof input?.TextInput === "string" ? input.TextInput.trim() : null;
  const menuRaw = input?.MenuEntryNumber;
  const menuEntryNumber =
    menuRaw != null && Number.isFinite(Number(menuRaw)) ? Number(menuRaw) : null;

  return {
    textInput: textInput || null,
    menuEntryNumber,
    poiId: typeof header?.POIID === "string" ? header.POIID : null,
    saleId: typeof header?.SaleID === "string" ? header.SaleID : null,
  };
}

export function parseSplitPaymentResponse(body: string | unknown): SplitPaymentParseResult {
  const root = normalizeRoot(body);
  if (!root) {
    return { status: "error", message: "Empty or invalid Adyen terminal response." };
  }

  const paymentResponse = (root.SaleToPOIResponse as Record<string, unknown> | undefined)
    ?.PaymentResponse as Record<string, unknown> | undefined;
  if (!paymentResponse) {
    return { status: "error", message: "Unexpected Adyen response format." };
  }

  const responseNode = paymentResponse.Response as Record<string, unknown> | undefined;
  if (!responseNode) {
    return { status: "error", message: "Missing payment response from terminal." };
  }

  const result = String(responseNode.Result || "").toLowerCase();
  const errorCondition =
    typeof responseNode.ErrorCondition === "string" ? responseNode.ErrorCondition : undefined;
  const additionalResponse =
    typeof responseNode.AdditionalResponse === "string"
      ? responseNode.AdditionalResponse
      : undefined;

  const saleData = paymentResponse.SaleData as Record<string, unknown> | undefined;
  const saleTx = saleData?.SaleTransactionID as Record<string, unknown> | undefined;
  const saleTransactionId =
    typeof saleTx?.TransactionID === "string" ? saleTx.TransactionID : null;
  const saleTransactionTimestamp =
    typeof saleTx?.TimeStamp === "string" ? saleTx.TimeStamp : null;

  const poiData = paymentResponse.POIData as Record<string, unknown> | undefined;
  const poiTx = poiData?.POITransactionID as Record<string, unknown> | undefined;
  const poiTransactionId =
    typeof poiTx?.TransactionID === "string" ? poiTx.TransactionID : null;
  const poiTransactionTimestamp =
    typeof poiTx?.TimeStamp === "string" ? poiTx.TimeStamp : null;

  const amountsResp = paymentResponse.PaymentResult as Record<string, unknown> | undefined;
  const amountsNode =
    (paymentResponse.PaymentTransaction as Record<string, unknown> | undefined)?.AmountsResp ||
    (amountsResp?.AmountsResp as Record<string, unknown> | undefined);
  const authorizedRaw =
    amountsNode && typeof amountsNode === "object"
      ? (amountsNode as Record<string, unknown>).AuthorizedAmount
      : undefined;
  const authorizedAmount =
    authorizedRaw != null && Number.isFinite(Number(authorizedRaw))
      ? Math.round(Number(authorizedRaw) * 100) / 100
      : undefined;

  const paymentResult = paymentResponse.PaymentResult as Record<string, unknown> | undefined;
  const instrumentData = paymentResult?.PaymentInstrumentData as Record<string, unknown> | undefined;
  const paymentInstrumentType =
    typeof instrumentData?.PaymentInstrumentType === "string"
      ? instrumentData.PaymentInstrumentType
      : null;

  if (result === "success") {
    return {
      status: "success",
      authorizedAmount,
      saleTransactionId,
      saleTransactionTimestamp,
      poiTransactionId,
      poiTransactionTimestamp,
      paymentInstrumentType,
    };
  }

  if (result === "partial") {
    return {
      status: "partial",
      authorizedAmount,
      saleTransactionId,
      saleTransactionTimestamp,
      poiTransactionId,
      poiTransactionTimestamp,
      paymentInstrumentType,
    };
  }

  if (errorCondition?.toLowerCase() === "paymentrestriction") {
    return { status: "pay_later", message: "Pay later selected on terminal." };
  }

  if (errorCondition?.toLowerCase() === "cancel") {
    return {
      status: "cancelled",
      message: paymentFailureMessage(errorCondition, additionalResponse),
    };
  }

  return {
    status: "failure",
    message: paymentFailureMessage(errorCondition, additionalResponse),
    authorizedAmount,
    saleTransactionId,
    saleTransactionTimestamp,
    poiTransactionId,
    poiTransactionTimestamp,
    paymentInstrumentType,
  };
}

function paymentFailureMessage(
  errorCondition?: string | null,
  additionalResponse?: string | null
): string {
  const cond = String(errorCondition || "").trim();
  if (/cancel/i.test(cond)) return "Payment cancelled on terminal";
  if (/refus|declin/i.test(cond)) return "Card declined";
  if (additionalResponse && additionalResponse.length <= 80 && !additionalResponse.includes("=")) {
    return additionalResponse.replace(/_/g, " ");
  }
  if (cond) return `Payment failed (${cond})`;
  return "Payment declined";
}

function normalizeRoot(body: unknown): Record<string, unknown> | null {
  if (!body) return null;
  if (typeof body === "string") {
    if (!body.trim()) return null;
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof body === "object") return body as Record<string, unknown>;
  return null;
}
