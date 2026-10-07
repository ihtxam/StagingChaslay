import { schema, type SmartSegmentsSettings } from "@/db";
export declare function normalizeSmartSegments(raw: SmartSegmentsSettings | null | undefined): SmartSegmentsSettings;
export declare class SmartSegmentsService {
    static getSettings(merchantId: string): Promise<schema.SmartSegmentsSettings>;
    static updateSettings(merchantId: string, raw: SmartSegmentsSettings): Promise<schema.SmartSegmentsSettings>;
    static apply(merchantId: string): Promise<{
        updated: number;
        matched: number;
        lastAppliedAt: string | null;
    }>;
    /** Preview counts per rule without writing tags. */
    static preview(merchantId: string): Promise<{
        rules: schema.SmartSegmentRule[];
        previews: {
            ruleId: string;
            tag: string;
            type: schema.SmartSegmentRuleType;
            threshold: number;
            count: number;
        }[];
        lastAppliedAt: string | null;
    }>;
}
//# sourceMappingURL=smart-segments.service.d.ts.map