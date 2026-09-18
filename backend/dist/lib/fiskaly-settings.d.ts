export type FiskalyEnvironment = "test" | "live";
export type FiskalyDeSettings = {
    apiKey?: string;
    apiSecret?: string;
    tssId?: string;
    clientId?: string;
    clientSerial?: string;
    adminPin?: string;
};
export type FiskalyFrSettings = {
    apiKey?: string;
    apiSecret?: string;
    unitId?: string;
    systemId?: string;
    taxpayerId?: string;
    locationId?: string;
    siren?: string;
};
export type FiskalySettings = {
    enabled?: boolean;
    environment?: FiskalyEnvironment;
    de?: FiskalyDeSettings;
    fr?: FiskalyFrSettings;
};
export type FiskalySignature = {
    country: "DE" | "FR";
    qrCodeData?: string | null;
    signature?: string | null;
    txNumber?: string | number | null;
    txId?: string | null;
    tssSerial?: string | null;
    signedAt?: string;
    raw?: Record<string, unknown>;
};
export type FiskalySettingsPublic = {
    enabled: boolean;
    environment: FiskalyEnvironment;
    de: {
        apiKeyMasked: string | null;
        apiKeySet: boolean;
        apiSecretMasked: string | null;
        apiSecretSet: boolean;
        tssId: string | null;
        clientId: string | null;
        clientSerial: string | null;
        adminPinSet: boolean;
    };
    fr: {
        apiKeyMasked: string | null;
        apiKeySet: boolean;
        apiSecretMasked: string | null;
        apiSecretSet: boolean;
        unitId: string | null;
        systemId: string | null;
        taxpayerId: string | null;
        locationId: string | null;
        siren: string | null;
    };
};
export declare function normalizeFiskalyEnvironment(raw?: string | null): FiskalyEnvironment;
export declare function normalizeFiskalySettings(raw?: FiskalySettings | Record<string, unknown> | null): FiskalySettings;
export declare function getFiskalyPublic(raw?: FiskalySettings | Record<string, unknown> | null): FiskalySettingsPublic;
export declare function mergeFiskalySettings(currentRaw: FiskalySettings | Record<string, unknown> | null | undefined, patchRaw: FiskalySettings | Record<string, unknown> | null | undefined): FiskalySettings;
export declare function isFiskalyCountrySupported(country?: string | null): boolean;
/** Normalize merchant.country to DE | FR | null (CH and others → null). */
export declare function normalizeCountry(country?: string | null): "DE" | "FR" | null;
//# sourceMappingURL=fiskaly-settings.d.ts.map