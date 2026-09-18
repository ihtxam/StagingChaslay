type LicenseActivationLogInput = {
    outcome: "success" | "failure";
    deviceId: string;
    activationCode: string;
    errorMessage?: string;
    tenantSlug?: string | null;
    appVersion?: string;
    deviceModel?: string;
    merchantId?: string | null;
    source?: "android_pos" | "android_client";
};
/** Hide raw Drizzle/SQL failures from the Android activation screen. */
export declare function publicLicenseActivationError(error: unknown): string;
/** Write a platform event log entry for superadmin System Logs. Returns log id as reference. */
export declare function logPosLicenseActivation(input: LicenseActivationLogInput): Promise<string>;
export {};
//# sourceMappingURL=license-activation-log.d.ts.map