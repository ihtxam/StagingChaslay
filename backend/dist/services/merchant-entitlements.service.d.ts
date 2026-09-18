export type MerchantLimits = {
    maxPosPosts: number;
    maxWaiterPosts: number;
    maxStaff: number;
    maxLocations: number;
    maxProducts: number | null;
    signageScreenLimit: number;
    planSlug: string | null;
    planName: string | null;
};
export type StaffLimitInfo = {
    maxStaff: number;
    currentCount: number;
    planSlug: string | null;
    planName: string | null;
};
export type DeviceLicenseLimitInfo = {
    maxDevices: number;
    currentCount: number;
    planSlug: string | null;
    planName: string | null;
};
export type LocationLimitInfo = {
    maxLocations: number;
    currentCount: number;
    planSlug: string | null;
    planName: string | null;
};
export declare class MerchantEntitlementsService {
    static getLimits(merchantId: string): Promise<MerchantLimits>;
    private static loadLimitsFromMerchantOnly;
    private static loadLimits;
    static countActiveLocations(merchantId: string): Promise<number>;
    static getLocationLimitInfo(merchantId: string): Promise<LocationLimitInfo>;
    static assertCanAddLocation(merchantId: string, addCount?: number): Promise<LocationLimitInfo>;
    static countActiveStaff(merchantId: string): Promise<number>;
    static getStaffLimitInfo(merchantId: string): Promise<StaffLimitInfo>;
    static assertCanAddStaff(merchantId: string, addCount?: number): Promise<StaffLimitInfo>;
    static countActiveDeviceLicenses(merchantId: string): Promise<number>;
    static getDeviceLicenseLimitInfo(merchantId: string): Promise<DeviceLicenseLimitInfo>;
    static assertCanIssueDeviceLicense(merchantId: string, addCount?: number, opts?: {
        skipIfDeviceAlreadyLicensed?: boolean;
        deviceId?: string;
    }): Promise<DeviceLicenseLimitInfo>;
}
//# sourceMappingURL=merchant-entitlements.service.d.ts.map