import { schema, type AiCoachCache } from "@/db";
export declare class AiCoachService {
    static getBrief(merchantId: string, opts?: {
        refresh?: boolean;
    }): Promise<schema.AiCoachCache>;
    static regenerate(merchantId: string): Promise<AiCoachCache>;
}
//# sourceMappingURL=ai-coach.service.d.ts.map