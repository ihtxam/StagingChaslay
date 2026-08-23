import { type MarketingSettings, type MerchantBrevoSettings, type MerchantSmtpSettings } from "@/db";
declare function normalizeSmtp(raw: MerchantSmtpSettings | null | undefined): MerchantSmtpSettings;
declare function normalizeBrevo(raw: MerchantBrevoSettings | null | undefined): MerchantBrevoSettings;
declare function normalizeMarketing(raw: MarketingSettings | null | undefined): MarketingSettings;
export declare class MarketingService {
    static getSmtpPublic(raw: MerchantSmtpSettings | null | undefined): {
        enabled: boolean | undefined;
        host: string | null | undefined;
        port: number | null | undefined;
        secure: boolean | undefined;
        user: string | null | undefined;
        passwordSet: boolean;
        fromEmail: string | null | undefined;
        fromName: string | null | undefined;
    };
    static getBrevoPublic(raw: MerchantBrevoSettings | null | undefined): {
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
    };
    static normalizeSmtp: typeof normalizeSmtp;
    static normalizeBrevo: typeof normalizeBrevo;
    static normalizeMarketing: typeof normalizeMarketing;
    static listAudience(merchantId: string): Promise<{
        id: string | null;
        email: string;
        name: string;
        phone: string | null;
        marketingOptIn: boolean;
        lastOrderAt: Date | null;
        totalSpent: string | null;
    }[]>;
    static listCampaigns(merchantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        title: string;
        subject: string;
        bodyHtml: string;
        designJson: Record<string, unknown> | null;
        audience: string;
        recipientCount: number | null;
        sentCount: number | null;
        failedCount: number | null;
        selectedEmails: string[] | null;
        sentAt: Date | null;
    }[]>;
    static saveCampaign(merchantId: string, input: {
        id?: string;
        title?: string;
        subject: string;
        bodyHtml: string;
        designJson?: Record<string, unknown> | null;
        audience?: "all" | "selected";
        selectedEmails?: string[];
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        title: string;
        subject: string;
        bodyHtml: string;
        designJson: Record<string, unknown> | null;
        audience: string;
        recipientCount: number | null;
        sentCount: number | null;
        failedCount: number | null;
        selectedEmails: string[] | null;
        sentAt: Date | null;
    }>;
    static sendCampaign(merchantId: string, campaignId: string, options?: {
        audience?: "all" | "selected";
        selectedEmails?: string[];
    }): Promise<{
        id: string;
        merchantId: string;
        title: string;
        subject: string;
        bodyHtml: string;
        designJson: Record<string, unknown> | null;
        status: string;
        audience: string;
        recipientCount: number | null;
        sentCount: number | null;
        failedCount: number | null;
        selectedEmails: string[] | null;
        sentAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /** Refresh lastOrderAt from latest non-cancelled order (by customerId or email). */
    static touchLastOrder(merchantId: string, opts: {
        customerId?: string | null;
        email?: string | null;
        at?: Date;
    }): Promise<void>;
    static processReorderReminders(): Promise<{
        sent: number;
    }>;
}
export {};
//# sourceMappingURL=marketing.service.d.ts.map