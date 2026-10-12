/** API 401 when Authorization Bearer was stripped or missing. */
export function isMissingAuthorizationError(err: unknown): boolean {
  const e = err as { response?: { status?: number; data?: { error?: string } } } | undefined;
  const status = e?.response?.status;
  const msg = String(e?.response?.data?.error || '');
  return status === 401 || /missing or invalid authorization/i.test(msg);
}
