/** Unified ordering channel for online shop + delivery aggregators. */
export type OrderSource = "online_shop" | "justeat" | "ubereats";
export type DeliveryPlatformKey = "justEat" | "uberEats";
export type DeliveryPlatformCredentials = {
    enabled?: boolean;
    /** When true, accept simplified test webhooks without live API credentials. */
    testMode?: boolean;
    storeId?: string | null;
    apiKey?: string | null;
    apiSecret?: string | null;
    clientId?: string | null;
    clientSecret?: string | null;
    webhookSecret?: string | null;
    /** Skip pending_approval and go straight to preparing (kitchen). */
    autoAccept?: boolean;
};
export type DeliveryPlatformSettings = {
    justEat?: DeliveryPlatformCredentials;
    uberEats?: DeliveryPlatformCredentials;
    /** Online shop orders skip pending_approval and go straight to preparing. */
    onlineShopAutoAccept?: boolean;
};
export declare function normalizeDeliveryPlatformSettings(raw: unknown): DeliveryPlatformSettings;
export declare function getDeliveryPlatformPublic(raw: unknown): DeliveryPlatformSettings & {
    justEat?: DeliveryPlatformCredentials & {
        apiKeySet?: boolean;
        apiKeyMasked?: string | null;
        apiSecretSet?: boolean;
        apiSecretMasked?: string | null;
        webhookSecretSet?: boolean;
        webhookSecretMasked?: string | null;
    };
    uberEats?: DeliveryPlatformCredentials & {
        clientId?: string | null;
        clientSecretSet?: boolean;
        clientSecretMasked?: string | null;
        webhookSecretSet?: boolean;
        webhookSecretMasked?: string | null;
    };
};
export declare function mergeDeliveryPlatformSettings(prevRaw: unknown, updatesRaw: unknown): DeliveryPlatformSettings;
/** Production API credentials present → live webhooks (test mode off). */
export declare function applyProductionCredentialDefaults(settings: DeliveryPlatformSettings): DeliveryPlatformSettings;
export declare function orderSourceFromPlatform(platform: string): OrderSource | null;
export declare function platformKeyFromSource(source: OrderSource): DeliveryPlatformKey | null;
//# sourceMappingURL=delivery-platform-settings.d.ts.map