import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function getUploadsRoot(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export function ensureUploadsRoot(): string {
  const root = getUploadsRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function publicUploadPath(merchantId: string, filename: string): string {
  return `/api/uploads/${merchantId}/${filename}`;
}

/**
 * Persist an uploaded image buffer under uploads/{merchantId}/…
 * Returns a public path served by Express static at /api/uploads.
 */
export async function saveMerchantImage(opts: {
  merchantId: string;
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<{ filename: string; url: string; mimeType: string; size: number }> {
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
  const dir = path.join(root, opts.merchantId);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${randomUUID()}${extFromMime}`;
  const fullPath = path.join(dir, filename);
  await fs.promises.writeFile(fullPath, opts.buffer);

  return {
    filename,
    url: publicUploadPath(opts.merchantId, filename),
    mimeType: resolvedMime,
    size: opts.buffer.length,
  };
}

export function isAllowedImageMime(mime: string): boolean {
  return !!ALLOWED_MIME[String(mime || "").toLowerCase()];
}

/** Detect image type from magic bytes when the browser sends an empty or generic MIME. */
export function sniffImageMime(buffer: Buffer): string | null {
  if (!buffer?.length) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function mimeFromFilename(originalName?: string): string | null {
  const ext = path.extname(String(originalName || "")).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return map[ext] || null;
}

/** Resolve a trusted image MIME from header, bytes, or filename extension. */
export function resolveImageMime(
  mimeType: string,
  buffer: Buffer,
  originalName?: string
): string {
  const normalized = String(mimeType || "").toLowerCase();
  if (isAllowedImageMime(normalized)) return normalized;
  const sniffed = sniffImageMime(buffer);
  if (sniffed) return sniffed;
  const fromName = mimeFromFilename(originalName);
  if (fromName) return fromName;
  throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed");
}
