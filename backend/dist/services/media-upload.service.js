"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUploadsRoot = getUploadsRoot;
exports.ensureUploadsRoot = ensureUploadsRoot;
exports.publicUploadPath = publicUploadPath;
exports.saveMerchantImage = saveMerchantImage;
exports.isAllowedImageMime = isAllowedImageMime;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const ALLOWED_MIME = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
};
function getUploadsRoot() {
    return process.env.UPLOAD_DIR || path_1.default.join(process.cwd(), "uploads");
}
function ensureUploadsRoot() {
    const root = getUploadsRoot();
    fs_1.default.mkdirSync(root, { recursive: true });
    return root;
}
function publicUploadPath(merchantId, filename) {
    return `/api/uploads/${merchantId}/${filename}`;
}
/**
 * Persist an uploaded image buffer under uploads/{merchantId}/…
 * Returns a public path served by Express static at /api/uploads.
 */
async function saveMerchantImage(opts) {
    const extFromMime = ALLOWED_MIME[opts.mimeType.toLowerCase()];
    if (!extFromMime) {
        throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed");
    }
    if (!opts.buffer?.length) {
        throw new Error("Empty file");
    }
    if (opts.buffer.length > 12 * 1024 * 1024) {
        throw new Error("Image must be 12 MB or smaller");
    }
    const root = ensureUploadsRoot();
    const dir = path_1.default.join(root, opts.merchantId);
    fs_1.default.mkdirSync(dir, { recursive: true });
    const filename = `${(0, crypto_1.randomUUID)()}${extFromMime}`;
    const fullPath = path_1.default.join(dir, filename);
    await fs_1.default.promises.writeFile(fullPath, opts.buffer);
    return {
        filename,
        url: publicUploadPath(opts.merchantId, filename),
        mimeType: opts.mimeType,
        size: opts.buffer.length,
    };
}
function isAllowedImageMime(mime) {
    return !!ALLOWED_MIME[String(mime || "").toLowerCase()];
}
//# sourceMappingURL=media-upload.service.js.map