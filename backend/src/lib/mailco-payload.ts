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

export type MailcoRawMessagePayload = {
  from: { email: string; name?: string };
  to: Array<{ email: string; name?: string }>;
  reply_to?: Array<{ email: string; name?: string }>;
  subject: string;
  html: string;
  text: string;
  attachments?: MailcoAttachmentPayload[];
  metadata: Record<string, string>;
};

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
  const replyTo = String(input.replyToEmail || "").trim();
  const attachments = buildMailcoAttachments(input.attachments);

  return {
    from: {
      email: input.fromEmail,
      name: input.fromName || undefined,
    },
    to: [{ email: input.to }],
    ...(replyTo
      ? {
          reply_to: [
            {
              email: replyTo,
              name: input.replyToName || input.fromName || undefined,
            },
          ],
        }
      : {}),
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
