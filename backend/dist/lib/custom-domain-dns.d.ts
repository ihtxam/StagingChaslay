export type DnsVerifyResult = {
    ok: boolean;
    method?: "cname" | "a";
    value?: string;
    expected?: string;
    reason?: string;
};
/**
 * Verify that a hostname points at the platform shop hub (CNAME or flattened A record).
 */
export declare function verifyCustomDomainDns(hostname: string): Promise<DnsVerifyResult>;
//# sourceMappingURL=custom-domain-dns.d.ts.map