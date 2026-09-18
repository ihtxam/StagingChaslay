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
exports.sniffImageMime = sniffImageMime;
exports.resolveImageMime = resolveImageMime;
exports.isAllowedFaviconMime = isAllowedFaviconMime;
exports.saveMerchantFavicon = saveMerchantFavicon;
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
    const resolvedMime = resolveImageMime(opts.mimeType, opts.buffer, opts.originalName);
    const extFromMime = ALLOWED_MIME[resolvedMime];
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
        mimeType: resolvedMime,
        size: opts.buffer.length,
    };
}
function isAllowedImageMime(mime) {
    return !!ALLOWED_MIME[String(mime || "").toLowerCase()];
}
/** Detect image type from magic bytes when the browser sends an empty or generic MIME. */
function sniffImageMime(buffer) {
    if (!buffer?.length)
        return null;
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }
    if (buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47) {
        return "image/png";
    }
    if (buffer.length >= 6 &&
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38) {
        return "image/gif";
    }
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50) {
        return "image/webp";
    }
    return null;
}
function mimeFromFilename(originalName) {
    const ext = path_1.default.extname(String(originalName || "")).toLowerCase();
    const map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    };
    return map[ext] || null;
}
/** Resolve a trusted image MIME from header, bytes, or filename extension. */
function resolveImageMime(mimeType, buffer, originalName) {
    const normalized = String(mimeType || "").toLowerCase();
    if (isAllowedImageMime(normalized))
        return normalized;
    const sniffed = sniffImageMime(buffer);
    if (sniffed)
        return sniffed;
    const fromName = mimeFromFilename(originalName);
    if (fromName)
        return fromName;
    throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed");
}
const FAVICON_MIME = {
    "image/png": ".png",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico",
    "image/svg+xml": ".svg",
};
function sniffIco(buffer) {
    return (buffer.length >= 4 &&
        buffer[0] === 0x00 &&
        buffer[1] === 0x00 &&
        (buffer[2] === 0x01 || buffer[2] === 0x02) &&
        buffer[3] === 0x00);
}
function sniffSvg(buffer) {
    const head = buffer.slice(0, 256).toString("utf8").replace(/^\uFEFF/, "").trimStart();
    if (head.startsWith("<svg"))
        return true;
    if (head.startsWith("<?xml") && /<svg[\s>]/i.test(buffer.slice(0, 2048).toString("utf8"))) {
        return true;
    }
    return false;
}
function resolveFaviconMime(mimeType, buffer, originalName) {
    const normalized = String(mimeType || "").toLowerCase();
    if (FAVICON_MIME[normalized])
        return normalized;
    if (sniffImageMime(buffer) === "image/png")
        return "image/png";
    if (sniffIco(buffer))
        return "image/x-icon";
    if (sniffSvg(buffer))
        return "image/svg+xml";
    const ext = path_1.default.extname(String(originalName || "")).toLowerCase();
    if (ext === ".png")
        return "image/png";
    if (ext === ".ico")
        return "image/x-icon";
    if (ext === ".svg")
        return "image/svg+xml";
    throw new Error("Favicon must be PNG, ICO, or SVG");
}
function isAllowedFaviconMime(mime) {
    const normalized = String(mime || "").toLowerCase();
    return !!FAVICON_MIME[normalized] || normalized === "image/png";
}
/**
 * Persist a shop favicon (PNG / ICO / SVG).
 */
async function saveMerchantFavicon(opts) {
    const resolvedMime = resolveFaviconMime(opts.mimeType, opts.buffer, opts.originalName);
    const extFromMime = FAVICON_MIME[resolvedMime];
    if (!extFromMime) {
        throw new Error("Favicon must be PNG, ICO, or SVG");
    }
    if (!opts.buffer?.length) {
        throw new Error("Empty file");
    }
    if (opts.buffer.length > 2 * 1024 * 1024) {
        throw new Error("Favicon must be 2 MB or smaller");
    }
    if (resolvedMime === "image/svg+xml") {
        const text = opts.buffer.toString("utf8").slice(0, 64 * 1024);
        if (/<script[\s>]/i.test(text) || /on\w+\s*=/i.test(text)) {
            throw new Error("SVG favicon cannot contain scripts");
        }
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
        mimeType: resolvedMime,
        size: opts.buffer.length,
    };
}
//# sourceMappingURL=media-upload.service.js.map