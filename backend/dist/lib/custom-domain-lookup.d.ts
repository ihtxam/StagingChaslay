import { schema } from "@/db";
type MerchantRow = typeof schema.merchants.$inferSelect;
/** Resolve merchant by custom domain Host, matching apex and www interchangeably. */
export declare function findMerchantByCustomDomainHost(hostOrSlug: string): Promise<MerchantRow | null>;
/** Same as findMerchantByCustomDomainHost but for TLS ask (verified/pending rules). */
export declare function findMerchantForTlsAsk(host: string): Promise<MerchantRow | null>;
export {};
//# sourceMappingURL=custom-domain-lookup.d.ts.map