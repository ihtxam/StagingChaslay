/**
 * SIX Swiss QR-bill (QR-Rechnung) helpers.
 *
 * Generates an SPC (Swiss Payments Code) payload per Implementation Guidelines
 * for the QR-bill, version 2.2 / 0200. This is not a SIX-certified renderer —
 * print measurements and the Swiss-cross overlay follow the spec closely but
 * banks may still require official certification for production QR-bills.
 */
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
export declare function mod10Recursive(digits: string): number;
/** 27-digit QRR reference from a numeric sequence (invoice number). */
export declare function buildQrrReference(sequence: number): string;
export declare function stripIban(raw: string): string;
export declare function isLikelyQrIban(iban: string): boolean;
/**
 * Build the SPC payload string (CRLF-separated) for a Swiss QR-bill.
 */
export declare function buildSwissQrPayload(input: SwissQrBillInput): string;
export type SwissQrRun = {
    x: number;
    y: number;
    w: number;
};
/**
 * QR module runs for vector drawing. Avoids PDFKit's broken RGBA-PNG embed
 * (png-js alpha decode is async and loses the race with doc.end()).
 */
export declare function swissQrModuleRuns(payload: string): {
    moduleCount: number;
    runs: SwissQrRun[];
};
export declare function parseAddressFromMerchant(opts: {
    name: string;
    address?: string | null;
    city?: string | null;
    country?: string | null;
}): QrAddress;
export declare function parseAddressFromCustomer(opts: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
}): QrAddress | null;
//# sourceMappingURL=swiss-qr-bill.d.ts.map