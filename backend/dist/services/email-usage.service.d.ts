import type { EmailSendType } from "@/db/schema";
export type EmailLogInput = {
    merchantId?: string | null;
    orderId?: string | null;
    provider: string;
    source: string;
    emailType: EmailSendType | string;
    recipient: string;
    subject?: string;
    status: "sent" | "failed";
    error?: string | null;
};
export declare class EmailUsageService {
    static ensureTable(): Promise<void>;
    static logSend(input: EmailLogInput): Promise<void>;
    static getPlatformUsageSummary(): Promise<{
        period: {
            day: string;
            month: string;
        };
        platformSources: string[];
        today: number;
        thisMonth: number;
        allTime: number;
        byType: {
            emailType: string;
            count: number;
        }[];
        byMerchant: {
            merchantId: string | null;
            merchantName: string;
            count: number;
        }[];
        brevo: {
            fromEmail: string;
            fromName: string;
            apiKeyMasked: string;
            apiKeySet: boolean;
            usingEnvFallback: boolean;
            configured: boolean;
            provider: string | null;
        };
        mailco: {
            fromEmail: string;
            fromName: string;
            apiBase: string;
            templateSlug: string;
            emailPrimary: import("@/services/platform-settings.service").PlatformEmailPrimary;
            apiKeyMasked: string;
            apiKeySet: boolean;
            usingEnvFallback: boolean;
            configured: boolean;
            provider: string | null;
        };
        platformEmailPrimary: import("@/services/platform-settings.service").PlatformEmailPrimary;
        activeProvider: "brevo" | "mailco" | "smtp" | "sendgrid" | null;
        activeFromEmail: string;
        activeFromName: string;
        lastShopOrderEmail: {
            provider: string;
            source: string;
            sentAt: Date;
            recipient: string;
            orderId: string | null;
            merchantId: string | null;
        } | null;
        allEmailViaMailco: boolean;
        mailcoBrevoFallbackEnabled: boolean;
        account: {
            email: string | undefined;
            companyName: string | undefined;
            planCredits: number | null;
            planCreditsType: string | null;
            planType: string | null;
        } | null;
    }>;
    static getOrderEmailLogs(orderId: string): Promise<{
        id: string;
        provider: string;
        source: string;
        emailType: string;
        recipient: string;
        subject: string | null;
        status: string;
        error: string | null;
        sentAt: Date;
        merchantId: string | null;
    }[]>;
    static getMerchantPlatformUsage(merchantId: string): Promise<{
        period: {
            day: string;
            month: string;
        };
        today: number;
        thisMonth: number;
    }>;
}
//# sourceMappingURL=email-usage.service.d.ts.map