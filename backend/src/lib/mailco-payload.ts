import { formatMailAddress } from "@/lib/merchant-email-address";

export type MailcoEmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

/** mailco POST /api/v1/messages attachment object (Brevo-compatible base64 JSON). */
export type MailcoAttachmentPayload = {
  name: string;
  content: string;
  content_type: string;
};

const DEFAULT_ATTACHMENT_TYPE = "application/octet-stream";

function attachmentBase64(content: Buffer | string): string {
  return Buffer.isBuffer(content) ? content.toString("base64") : Buffer.from(String(content)).toString("base64");
}

function guessContentType(filename: string, explicit?: string): string {
  const type = String(explicit || "").trim();
  if (type) return type;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return DEFAULT_ATTACHMENT_TYPE;
}

/** Map Reborn EmailAttachment[] to mailco raw-message attachment JSON. */
export function buildMailcoAttachments(
  attachments: MailcoEmailAttachment[] | null | undefined
): MailcoAttachmentPayload[] {
  if (!attachments?.length) return [];
  return attachments.map((a) => {
    const name = String(a.filename || "attachment").trim() || "attachment";
    return {
      name,
      content: attachmentBase64(a.content),
      content_type: guessContentType(name, a.contentType),
    };
  });
}

export type MailcoAddress = { email: string; name?: string };

export type MailcoRawMessagePayload = {
  from: MailcoAddress;
  to: MailcoAddress[];
  /** Brevo-style single reply address (mailco relay accepts object or array; object is preferred). */
  reply_to?: MailcoAddress;
  headers?: Record<string, string>;
  subject: string;
  html: string;
  text: string;
  attachments?: MailcoAttachmentPayload[];
  metadata: Record<string, string>;
};

/** Visible From name for platform Mailco / Postal (hello@… must not appear as “hello”). */
export const DEFAULT_PLATFORM_FROM_NAME = "RebornPOS";

/** Old/empty/local-part names that inboxes treat as the mailbox user (“hello”). */
const GENERIC_PLATFORM_FROM_NAMES = new Set(["", "reborn", "hello", "noreply", "no-reply", "mailer"]);

function emailLocalPart(email?: string | null): string {
  const trimmed = String(email || "").trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "";
  return trimmed.slice(0, at).toLowerCase();
}

/**
 * Platform From display name. Rejects empty, the mailbox local-part (hello@… → “hello”),
 * and the previous default “Reborn” so receipts show RebornPOS.
 */
export function resolveMailcoFromName(
  name?: string | null,
  fromEmail?: string | null,
  fallback = DEFAULT_PLATFORM_FROM_NAME
): string {
  const trimmed = String(name || "").trim();
  const local = emailLocalPart(fromEmail);
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (GENERIC_PLATFORM_FROM_NAMES.has(lower)) return fallback;
  if (local && lower === local) return fallback;
  return trimmed;
}

export function buildMailcoRawMessagePayload(input: {
  fromEmail: string;
  fromName?: string | null;
  to: string;
  replyToEmail?: string | null;
  replyToName?: string | null;
  subject: string;
  html: string;
  text?: string | null;
  attachments?: MailcoEmailAttachment[] | null;
  emailType?: string | null;
  merchantId?: string | null;
}): MailcoRawMessagePayload {
  const text =
    String(input.text || "")
      .trim() ||
    input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const replyToEmail = String(input.replyToEmail || "").trim();
  const fromName = resolveMailcoFromName(input.fromName, input.fromEmail);
  const replyToName = String(input.replyToName || "").trim() || fromName;
  const attachments = buildMailcoAttachments(input.attachments);

  const replyTo = replyToEmail
    ? {
        email: replyToEmail,
        name: replyToName,
      }
    : undefined;

  const headers: Record<string, string> = {
    From: formatMailAddress(input.fromEmail, fromName),
  };
  if (replyTo) {
    headers["Reply-To"] = formatMailAddress(replyTo.email, replyTo.name);
  }

  return {
    from: {
      email: input.fromEmail,
      name: fromName,
    },
    to: [{ email: input.to }],
    ...(replyTo ? { reply_to: replyTo } : {}),
    headers,
    subject: input.subject,
    html: input.html,
    text,
    ...(attachments.length ? { attachments } : {}),
    metadata: {
      email_type: String(input.emailType || "general"),
      merchant_id: input.merchantId ? String(input.merchantId) : "",
    },
  };
}
