export type AccountingAccountMap = {
    salesRevenue?: string | null;
    vatPayable?: string | null;
    cash?: string | null;
    cardClearing?: string | null;
    terminalClearing?: string | null;
    tips?: string | null;
    discounts?: string | null;
    refunds?: string | null;
};
export type BexioIntegrationConfig = {
    enabled?: boolean;
    /** export_only | api */
    syncMode?: "export_only" | "api";
    personalAccessToken?: string | null;
    oauthAccessToken?: string | null;
    oauthRefreshToken?: string | null;
    oauthExpiresAt?: string | null;
    oauthScope?: string | null;
    oauthConnectedAt?: string | null;
    referencePrefix?: string | null;
    accounts?: AccountingAccountMap;
    /** Bexio tax_id or code per VAT label, e.g. "8.1%": "17" */
    vatCodeByLabel?: Record<string, string>;
    lastPushedReference?: string | null;
    lastPushedAt?: string | null;
    lastPushError?: string | null;
};
export type OdooIntegrationConfig = {
    enabled?: boolean;
    syncMode?: "export_only" | "api";
    baseUrl?: string | null;
    database?: string | null;
    username?: string | null;
    apiKey?: string | null;
    journalCode?: string | null;
    accounts?: AccountingAccountMap;
    lastPushedReference?: string | null;
    lastPushedAt?: string | null;
    lastPushError?: string | null;
};
export type AccountingIntegrationSettings = {
    bexio?: BexioIntegrationConfig;
    odoo?: OdooIntegrationConfig;
};
export declare function normalizeAccountingIntegrationSettings(raw: unknown): AccountingIntegrationSettings;
export declare function getAccountingIntegrationPublic(raw: unknown): {
    bexio: {
        personalAccessToken: undefined;
        oauthAccessToken: undefined;
        oauthRefreshToken: undefined;
        personalAccessTokenSet: boolean;
        personalAccessTokenMasked: string | null;
        oauthConnected: boolean;
        oauthConnectedAt: string | null;
        enabled?: boolean;
        /** export_only | api */
        syncMode?: "export_only" | "api";
        oauthExpiresAt?: string | null;
        oauthScope?: string | null;
        referencePrefix?: string | null;
        accounts?: AccountingAccountMap;
        /** Bexio tax_id or code per VAT label, e.g. "8.1%": "17" */
        vatCodeByLabel?: Record<string, string>;
        lastPushedReference?: string | null;
        lastPushedAt?: string | null;
        lastPushError?: string | null;
    };
    odoo: {
        apiKey: undefined;
        apiKeySet: boolean;
        apiKeyMasked: string | null;
        enabled?: boolean;
        syncMode?: "export_only" | "api";
        baseUrl?: string | null;
        database?: string | null;
        username?: string | null;
        journalCode?: string | null;
        accounts?: AccountingAccountMap;
        lastPushedReference?: string | null;
        lastPushedAt?: string | null;
        lastPushError?: string | null;
    };
};
export declare function mergeAccountingIntegrationSettings(prevRaw: unknown, updatesRaw: unknown): AccountingIntegrationSettings;
export declare function defaultAccountingAccountMap(): AccountingAccountMap;
//# sourceMappingURL=accounting-integration-settings.d.ts.map