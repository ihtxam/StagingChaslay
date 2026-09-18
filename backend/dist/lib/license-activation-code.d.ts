/** Canonical alphanumeric form of a POS activation / license code. */
export declare function compactActivationCode(code: string): string;
/** Reborn short codes are 12 hex chars grouped as XXXX-XXXX-XXXX. */
export declare function formatShortActivationCode(compact: string): string;
/**
 * Normalize what the user typed so it matches stored Reborn codes.
 * Strips spaces, accepts upper/lower case, and inserts hyphens for 12-char codes.
 */
export declare function normalizeActivationCode(code: string): string;
/** Candidate license_key values to try before a compact SQL fallback. */
export declare function activationCodeLookupKeys(code: string): string[];
export declare function isPlaceholderDeviceId(externalId: string): boolean;
export type UnusedDeviceProbe = {
    lastSync?: Date | string | null;
    appVersion?: string | null;
};
/** Issued in admin but never actually activated from a tablet. */
export declare function isUnusedIssuedDevice(device: UnusedDeviceProbe | null | undefined): boolean;
export declare function canRebindLicenseDevice(device: (UnusedDeviceProbe & {
    deviceId?: string;
}) | null | undefined, incomingMatchesStored: boolean): boolean;
//# sourceMappingURL=license-activation-code.d.ts.map