import type { schema } from "@/db";
type Merchant = typeof schema.merchants.$inferSelect;
/**
 * Adyen Tap to Pay (SoftPOS) backend helpers.
 *
 * Re-implemented in TypeScript for FoodTruckPOS from the proven Laravel
 * reference (SoftPosClient + TerminalApiClient::buildSaleRequest). Uses each
 * merchant's own Adyen credentials, so it is tenant-scoped like the rest of the
 * backend. No global Adyen state.
 */
interface SoftPosSession {
    installationId: string;
    sdkData: string;
    merchantAccount: string;
}
/**
 * Exchange a Mobile-SDK setupToken for sdkData + installationId via the Adyen
 * SoftPOS Configuration API (POST /softposconfig/v3/auth/certificate).
 */
export declare function createSoftPosSession(merchant: Merchant, setupToken: string): Promise<SoftPosSession>;
interface SaleEnvelope {
    request: Record<string, unknown>;
    serviceId: string;
    saleId: string;
    transactionId: string;
}
/**
 * Build a SaleToPOIRequest (nexo Terminal API) envelope. The mobile SDK runs
 * the EMV kernel and submits this envelope itself; the backend only constructs
 * it (no Adyen call here). Result-status arrives later via the AUTHORISATION
 * webhook.
 */
export declare function buildSaleRequest(merchant: Merchant, installationId: string, amountMinor: number, currency: string, reference: string): SaleEnvelope;
export {};
//# sourceMappingURL=adyen-softpos.service.d.ts.map