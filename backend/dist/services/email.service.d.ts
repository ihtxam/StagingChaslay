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
type EmailProvider = "smtp" | "brevo" | "sendgrid" | null;
type ResolvedEmailConfig = {
    provider: EmailProvider;
    apiKey: string;
    fromEmail: string;
    fromName: string;
    source: "merchant_smtp" | "merchant_brevo" | "database" | "env" | "none";
    smtp?: MerchantSmtpSettings | null;
    merchantId?: string | null;
};
/**
 * Prefer platform Brevo when merchant emailDeliveryMode is platform;
 * otherwise merchant SMTP, then merchant Brevo, then platform Brevo, then SendGrid.
 */
export declare class EmailService {
    private static envBrevoApiKey;
    private static envFromAddress;
    private static envFromName;
    /** Merchant emails show the shop name as sender; Brevo/SMTP from address stays authenticated. */
    private static merchantSenderName;
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
    private static sendViaSmtp;
    private static sendViaBrevo;
}
export {};
//# sourceMappingURL=email.service.d.ts.map