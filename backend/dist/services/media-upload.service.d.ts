export declare function getUploadsRoot(): string;
export declare function ensureUploadsRoot(): string;
export declare function publicUploadPath(merchantId: string, filename: string): string;
/**
 * Persist an uploaded image buffer under uploads/{merchantId}/…
 * Returns a public path served by Express static at /api/uploads.
 */
export declare function saveMerchantImage(opts: {
    merchantId: string;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
}): Promise<{
    filename: string;
    url: string;
    mimeType: string;
    size: number;
}>;
export declare function isAllowedImageMime(mime: string): boolean;
/** Detect image type from magic bytes when the browser sends an empty or generic MIME. */
export declare function sniffImageMime(buffer: Buffer): string | null;
/** Resolve a trusted image MIME from header, bytes, or filename extension. */
export declare function resolveImageMime(mimeType: string, buffer: Buffer, originalName?: string): string;
export declare function isAllowedFaviconMime(mime: string): boolean;
/**
 * Persist a shop favicon (PNG / ICO / SVG).
 */
export declare function saveMerchantFavicon(opts: {
    merchantId: string;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
}): Promise<{
    filename: string;
    url: string;
    mimeType: string;
    size: number;
}>;
//# sourceMappingURL=media-upload.service.d.ts.map