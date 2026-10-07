import { type GoogleReputationSettings } from "@/db";
export declare class GoogleReputationService {
    static getSettings(merchantId: string): Promise<GoogleReputationSettings>;
    static updateSettings(merchantId: string, input: Partial<GoogleReputationSettings>): Promise<GoogleReputationSettings>;
    static addReview(merchantId: string, input: {
        authorName?: string;
        rating?: number;
        text: string;
    }): Promise<{
        review: GoogleReputationReview;
        settings: GoogleReputationSettings;
    }>;
    static draftReplyForReview(merchantId: string, reviewId: string): Promise<GoogleReputationSettings>;
    static markReplied(merchantId: string, reviewId: string): Promise<GoogleReputationSettings>;
}
//# sourceMappingURL=google-reputation.service.d.ts.map