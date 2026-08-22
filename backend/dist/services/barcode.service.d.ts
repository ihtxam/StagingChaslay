/** Internal series: 20 + 10 digits (12-digit number, not a GS1 EAN-13). */
export declare const INTERNAL_BARCODE_PREFIX = "20";
export declare const INTERNAL_BARCODE_LENGTH: number;
/** Numeric SKU (8–12 digits) may be copied as barcode; never letter prefixes. */
export declare function isNumericSkuAsBarcode(sku: string): boolean;
/** @deprecated Use isNumericSkuAsBarcode — generated codes are digits only. */
export declare function isSafeSkuAsBarcode(sku: string): boolean;
export declare function formatInternalBarcode(seq: number): string;
/** Allocate the next merchant-unique 12-digit internal barcode (20 + 10 digits). Mutates `taken`. */
export declare function allocateInternalBarcode(taken: Set<string>): string | null;
export declare class BarcodeService {
    static generateMissing(merchantId: string, opts?: {
        productIds?: string[];
        useSku?: boolean;
    }): Promise<{
        generated: number;
        skipped: number;
        products: Array<{
            id: string;
            barcode: string;
        }>;
    }>;
    static normalizeForSave(raw?: string | null): string | null;
}
//# sourceMappingURL=barcode.service.d.ts.map