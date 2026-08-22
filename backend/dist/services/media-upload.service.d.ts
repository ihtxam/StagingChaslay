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
//# sourceMappingURL=media-upload.service.d.ts.map