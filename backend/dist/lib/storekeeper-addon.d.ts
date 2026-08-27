export declare function isStorekeeperAddonEnabled(value: unknown): boolean;
export declare class StorekeeperLicenseError extends Error {
    constructor(message?: string);
}
/** Storekeeper mobile app — own addon, or bundled with full inventory addon. */
export declare function readStorekeeperAddonEnabled(merchantId: string): Promise<boolean>;
export declare function writeStorekeeperAddonEnabled(merchantId: string, enabled: boolean): Promise<boolean>;
export declare function assertStorekeeperLicensed(merchantId: string): Promise<void>;
//# sourceMappingURL=storekeeper-addon.d.ts.map