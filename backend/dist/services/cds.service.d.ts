import { type CustomerDisplaySettings } from "@/lib/customer-display-settings";
import { type CdsLiveState } from "@/lib/cds-live-state";
export declare class CdsService {
    static buildPublicUrl(merchantSlug?: string | null, settings?: CustomerDisplaySettings | null): string;
    static configForToken(accessKey: string): Promise<{
        merchant: {
            id: string;
            name: string;
            slug: string;
            logoUrl: string | null;
        };
        settings: {
            promoSlides: import("../lib/kiosk-settings").KioskPromoSlide[];
            slideIntervalSec: number;
            theme: string;
            shortCode: string | null;
            syncToken: string | undefined;
            displayUrl: string;
        };
    }>;
    static configForSlug(slug: string): Promise<{
        merchant: {
            id: string;
            name: string;
            slug: string;
            logoUrl: string | null;
        };
        settings: {
            promoSlides: import("../lib/kiosk-settings").KioskPromoSlide[];
            slideIntervalSec: number;
            theme: string;
            shortCode: string | null;
            syncToken: string | undefined;
            displayUrl: string;
        };
    }>;
    private static formatConfigResponse;
    static getSettings(merchantId: string): Promise<CustomerDisplaySettings>;
    static getSettingsMeta(merchantId: string): Promise<{
        settings: CustomerDisplaySettings;
        merchantSlug: string | null;
        displayUrl: string;
    }>;
    static updateSettings(merchantId: string, raw: unknown): Promise<CustomerDisplaySettings>;
    static rotateToken(merchantId: string): Promise<CustomerDisplaySettings>;
    static pushLiveState(merchantId: string, raw: unknown): Promise<CdsLiveState>;
    static liveStateForToken(accessKey: string): Promise<CdsLiveState | null>;
    static liveStateForSlug(slug: string): Promise<CdsLiveState | null>;
}
//# sourceMappingURL=cds.service.d.ts.map