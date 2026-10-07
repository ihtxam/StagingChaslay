import { type AiWebSeoSettings } from "@/db";
export declare class AiWebSeoService {
    static getSettings(merchantId: string): Promise<AiWebSeoSettings>;
    static updateSettings(merchantId: string, input: Partial<AiWebSeoSettings>): Promise<AiWebSeoSettings>;
    static runScan(merchantId: string): Promise<AiWebSeoSettings>;
}
//# sourceMappingURL=ai-web-seo.service.d.ts.map