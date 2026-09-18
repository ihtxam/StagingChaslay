import type { EmailSendType } from "@/db/schema";
export type EmailLogInput = {
    merchantId?: string | null;
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
        account: {
            email: string | undefined;
            companyName: string | undefined;
            planCredits: number | null;
            planCreditsType: string | null;
            planType: string | null;
        } | null;
    }>;
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