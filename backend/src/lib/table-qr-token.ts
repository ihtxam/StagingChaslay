import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 365; // 1 year for static table QR stickers

function secret(): string {
  return (
    process.env.TABLE_QR_SIGNING_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SYNC_API_KEY_FALLBACK ||
    "dev-table-qr-secret"
  );
}

/** Signed table access token: base64url(payload).base64url(hmac) */
export function signTableAccess(
  merchantId: string,
  tableId: string,
  ttlSec = DEFAULT_TTL_SEC
): string {
  const exp = Math.floor(Date.now() / 1000) + Math.max(3600, ttlSec);
  const payload = `${merchantId}:${tableId}:${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  const body = Buffer.from(payload).toString("base64url");
  return `${body}.${sig}`;
}

export function verifyTableAccess(
  merchantId: string,
  tableId: string,
  token: string | null | undefined
): boolean {
  const raw = String(token || "").trim();
  if (!raw) return true; // legacy unsigned URLs still work
  const [body, sig] = raw.split(".");
  if (!body || !sig) return false;
  try {
    const payload = Buffer.from(body, "base64url").toString("utf8");
    const [mid, tid, expStr] = payload.split(":");
    if (mid !== merchantId || tid !== tableId) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
