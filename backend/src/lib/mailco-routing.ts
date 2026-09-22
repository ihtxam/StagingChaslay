/** True when mailco failed transiently and Brevo fallback is appropriate (not config errors). */
export function isTransientMailcoError(error: unknown): boolean {
  if (!error || typeof error !== "object") return true;
  const e = error as { response?: { status?: number }; code?: string; message?: string };
  const status = e.response?.status;
  if (status === 401 || status === 403 || status === 422) return false;
  if (status === 429 || status === 503 || (status != null && status >= 500)) return true;
  const code = String(e.code || "");
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || code === "ENOTFOUND") return true;
  const msg = String(e.message || "").toLowerCase();
  if (
    /invalid_api_key|scope_denied|template_invalid|recipient_suppressed|idempotency_conflict/.test(
      msg
    )
  ) {
    return false;
  }
  return status == null;
}
