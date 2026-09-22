/** Transactional shop order emails always use platform mailco when configured (never merchant Brevo). */
export const PLATFORM_MAILCO_EMAIL_TYPES = new Set([
  "shop_order",
  "platform_shop_order",
  "platform_shop_status",
]);

export function isPlatformMailcoEmailType(emailType?: string | null): boolean {
  return PLATFORM_MAILCO_EMAIL_TYPES.has(String(emailType || "").trim());
}

/** Error thrown when mailco API rejects a send — preserves HTTP status for routing decisions. */
export class MailcoSendError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, opts?: { status?: number; code?: string }) {
    super(message);
    this.name = "MailcoSendError";
    this.status = opts?.status;
    this.code = opts?.code;
  }
}

function readStatus(error: unknown): number | undefined {
  if (error instanceof MailcoSendError) return error.status;
  if (!error || typeof error !== "object") return undefined;
  const e = error as { response?: { status?: number }; status?: number };
  return e.response?.status ?? e.status;
}

function readCode(error: unknown): string | undefined {
  if (error instanceof MailcoSendError) return error.code;
  if (!error || typeof error !== "object") return undefined;
  const e = error as { code?: string };
  return e.code ? String(e.code) : undefined;
}

/**
 * When false (default), platform mailco sends never fall back to Brevo — failures are logged and thrown.
 * Set MAILCO_BREVO_FALLBACK=1 (or true/yes) to allow Brevo only on transient mailco outages (5xx/429/timeouts).
 */
export function isMailcoBrevoFallbackEnabled(): boolean {
  const raw = String(process.env.MAILCO_BREVO_FALLBACK || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** True when mailco failed transiently and Brevo fallback is appropriate (not config errors). */
export function isTransientMailcoError(error: unknown): boolean {
  const status = readStatus(error);
  if (status === 429 || status === 503 || (status != null && status >= 500)) return true;
  if (status === 401 || status === 403 || status === 422) return false;
  if (status != null && status >= 400 && status < 500) return false;

  const code = readCode(error);
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "ECONNRESET") {
    return true;
  }

  const msg = String((error as { message?: string })?.message || "").toLowerCase();
  if (
    /invalid_api_key|scope_denied|template_invalid|recipient_suppressed|idempotency_conflict/.test(
      msg
    )
  ) {
    return false;
  }

  // Unknown errors must not silently fall back — only explicit transient signals above.
  return false;
}
