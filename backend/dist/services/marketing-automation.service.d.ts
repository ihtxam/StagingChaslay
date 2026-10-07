import { schema, type MarketingAutomationSettings, type MarketingAutomationTrigger } from "@/db";
export declare function normalizeMarketingAutomation(raw: MarketingAutomationSettings | null | undefined): MarketingAutomationSettings;
export declare class MarketingAutomationService {
    static getSettings(merchantId: string): Promise<schema.MarketingAutomationSettings>;
    static updateSettings(merchantId: string, raw: MarketingAutomationSettings): Promise<schema.MarketingAutomationSettings>;
    static trigger(merchantId: string, trigger: MarketingAutomationTrigger, ctx: {
        email?: string | null;
        name?: string | null;
    }): Promise<void>;
}
//# sourceMappingURL=marketing-automation.service.d.ts.map