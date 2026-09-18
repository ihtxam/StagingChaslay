import type { MerchantBrevoSettings, MerchantSmtpSettings, EmailSendType } from "@/db/schema";
export type EmailAttachment = {
    filename: string;
    content: Buffer | string;
    contentType?: string;
};
export type SendEmailInput = {
    to: string;
    subject: string;
    html: string;
    text?: string;
    /** Optional merchant override for SMTP / from */
    merchantId?: string;
    attachments?: EmailAttachment[];
    /** Category for platform usage reporting */
    emailType?: EmailSendType | string;
};
type EmailProvider = "smtp" | "brevo" | "mailco" | "sendgrid" | null;
type ResolvedEmailConfig = {
    provider: EmailProvider;
    apiKey: string;
    fromEmail: string;
    fromName: string;
    /** Customer replies go here (merchant inbox) when platform sends on their behalf. */
    replyToEmail?: string | null;
    replyToName?: string | null;
    source: "merchant_smtp" | "merchant_brevo" | "database" | "env" | "none";
    smtp?: MerchantSmtpSettings | null;
    merchantId?: string | null;
    mailco?: {
        apiBase: string;
        templateSlug: string;
    };
    /** When primary is mailco, Brevo may still be used as automatic fallback. */
    fallbackBrevo?: {
        apiKey: string;
        fromEmail: string;
        fromName: string;
    } | null;
    /** Merchant SMTP used when platform mailco/Brevo is missing or fails. */
    fallbackSmtp?: MerchantSmtpSettings | null;
};
/**
 * Prefer platform mailco (with Brevo fallback) when merchant emailDeliveryMode is platform;
 * otherwise merchant SMTP, then merchant Brevo, then platform mailco/Brevo, then SendGrid.
 */
export declare class EmailService {
    private static envBrevoApiKey;
    private static envFromAddress;
    private static envFromName;
    /** Merchant emails show the shop name as sender; Brevo/SMTP from address stays authenticated. */
    private static merchantSenderName;
    /** Reply address for customer-facing mail — merchant inbox, not platform noreply. */
    private static merchantReplyTo;
    static resolveConfig(merchantId?: string | null): Promise<ResolvedEmailConfig>;
    static isConfigured(merchantId?: string | null): Promise<boolean>;
    /** Roll daily/monthly counters for the current Zurich calendar periods. */
    static rollBrevoCounters(raw: MerchantBrevoSettings | null | undefined): MerchantBrevoSettings;
    static getMerchantBrevoUsage(merchantId: string): Promise<{
        dailyRemaining: number | null;
        monthlyRemaining: number | null;
        account: {
            email?: string;
            companyName?: string;
            planCredits?: number | null;
            planCreditsType?: string | null;
            planType?: string | null;
            error?: string;
        } | null;
        enabled: boolean | undefined;
        apiKeySet: boolean;
        apiKeyMasked: string;
        fromEmail: string | null | undefined;
        fromName: string | null | undefined;
        dailyLimit: number | null | undefined;
        monthlyLimit: number | null | undefined;
        dailySent: number;
        dailyPeriod: string | null | undefined;
        monthlySent: number;
        monthlyPeriod: string | null | undefined;
    }>;
    static fetchBrevoAccount(apiKey: string): Promise<{
        email: string | undefined;
        companyName: string | undefined;
        planCredits: number | null;
        planCreditsType: string | null;
        planType: string | null;
    }>;
    private static assertMerchantBrevoLimits;
    private static incrementMerchantBrevoUsage;
    static status(merchantId?: string | null): Promise<{
        configured: boolean;
        provider: EmailProvider;
        fromEmail: string;
        fromName: string;
        source: "none" | "database" | "env" | "merchant_smtp" | "merchant_brevo";
        apiKeySet: boolean;
        apiKeyMasked: string;
        brevoKeySet: boolean;
        mailcoKeySet: boolean;
        mailcoConfigured: boolean;
        platformEmailPrimary: import("@/services/platform-settings.service").PlatformEmailPrimary;
        sendgridKeySet: boolean;
        smtpEnabled: boolean;
        usingPlatformEmail: boolean;
        merchantBrevo: {
            dailyRemaining: number | null;
            monthlyRemaining: number | null;
            account: {
                email?: string;
                companyName?: string;
                planCredits?: number | null;
                planCreditsType?: string | null;
                planType?: string | null;
                error?: string;
            } | null;
            enabled: boolean | undefined;
            apiKeySet: boolean;
            apiKeyMasked: string;
            fromEmail: string | null | undefined;
            fromName: string | null | undefined;
            dailyLimit: number | null | undefined;
            monthlyLimit: number | null | undefined;
            dailySent: number;
            dailyPeriod: string | null | undefined;
            monthlySent: number;
            monthlyPeriod: string | null | undefined;
        } | null;
    }>;
    static send(input: SendEmailInput): Promise<void>;
    private static formatReplyTo;
    private static sendViaSmtp;
    private static sendViaMailco;
    private static sendViaBrevo;
}
export {};
//# sourceMappingURL=email.service.d.ts.map