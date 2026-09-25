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
/** Map Reborn EmailAttachment[] to mailco raw-message attachment JSON. */
export declare function buildMailcoAttachments(attachments: MailcoEmailAttachment[] | null | undefined): MailcoAttachmentPayload[];
export type MailcoAddress = {
    email: string;
    name?: string;
};
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
export declare function buildMailcoRawMessagePayload(input: {
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
}): MailcoRawMessagePayload;
//# sourceMappingURL=mailco-payload.d.ts.map