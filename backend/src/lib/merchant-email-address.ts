import type { MerchantBrevoSettings, MerchantSmtpSettings } from "@/db/schema";

/** Display name shown in From / Reply-To for merchant-facing mail. */
export function merchantSenderDisplayName(merchantName: string | null | undefined): string {
  const name = String(merchantName || "").trim();
  return name || "Shop";
}

/** Merchant inbox for customer replies — settings email first, then configured SMTP/Brevo from. */
export function resolveMerchantContactEmail(input: {
  email?: string | null;
  smtpSettings?: MerchantSmtpSettings | null;
  brevoSettings?: MerchantBrevoSettings | null;
}): string | null {
  const primary = String(input.email || "").trim();
  if (primary) return primary;

  const smtpFrom = String(input.smtpSettings?.fromEmail || "").trim();
  if (smtpFrom) return smtpFrom;

  const brevoFrom = String(input.brevoSettings?.fromEmail || "").trim();
  if (brevoFrom) return brevoFrom;

  return null;
}

/** RFC-style mailbox for Reply-To / SMTP headers: `"Shop Name" <shop@example.com>`. */
export function formatMailAddress(email: string, name?: string | null): string {
  const addr = String(email || "").trim();
  if (!addr) return "";
  const label = String(name || "").trim();
  if (!label) return addr;
  const escaped = label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${addr}>`;
}
