"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMailcoAttachments = buildMailcoAttachments;
exports.buildMailcoRawMessagePayload = buildMailcoRawMessagePayload;
const merchant_email_address_1 = require("@/lib/merchant-email-address");
const DEFAULT_ATTACHMENT_TYPE = "application/octet-stream";
function attachmentBase64(content) {
    return Buffer.isBuffer(content) ? content.toString("base64") : Buffer.from(String(content)).toString("base64");
}
function guessContentType(filename, explicit) {
    const type = String(explicit || "").trim();
    if (type)
        return type;
    const lower = filename.toLowerCase();
    if (lower.endsWith(".pdf"))
        return "application/pdf";
    if (lower.endsWith(".xlsx")) {
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    if (lower.endsWith(".xls"))
        return "application/vnd.ms-excel";
    if (lower.endsWith(".csv"))
        return "text/csv";
    if (lower.endsWith(".png"))
        return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
        return "image/jpeg";
    return DEFAULT_ATTACHMENT_TYPE;
}
/** Map Reborn EmailAttachment[] to mailco raw-message attachment JSON. */
function buildMailcoAttachments(attachments) {
    if (!attachments?.length)
        return [];
    return attachments.map((a) => {
        const name = String(a.filename || "attachment").trim() || "attachment";
        return {
            name,
            content: attachmentBase64(a.content),
            content_type: guessContentType(name, a.contentType),
        };
    });
}
const DEFAULT_FROM_NAME = "Reborn";
function normalizeDisplayName(name, fallback = DEFAULT_FROM_NAME) {
    return String(name || "").trim() || fallback;
}
function buildMailcoRawMessagePayload(input) {
    const text = String(input.text || "")
        .trim() ||
        input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const replyToEmail = String(input.replyToEmail || "").trim();
    const fromName = normalizeDisplayName(input.fromName);
    const replyToName = normalizeDisplayName(input.replyToName || input.fromName, fromName);
    const attachments = buildMailcoAttachments(input.attachments);
    const replyTo = replyToEmail
        ? {
            email: replyToEmail,
            name: replyToName,
        }
        : undefined;
    return {
        from: {
            email: input.fromEmail,
            name: fromName,
        },
        to: [{ email: input.to }],
        ...(replyTo
            ? {
                reply_to: replyTo,
                headers: {
                    "Reply-To": (0, merchant_email_address_1.formatMailAddress)(replyTo.email, replyTo.name),
                },
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
//# sourceMappingURL=mailco-payload.js.map