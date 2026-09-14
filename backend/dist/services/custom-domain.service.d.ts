export type CustomDomainDnsStatus = "none" | "pending" | "verified" | "failed";
export type CustomDomainSslStatus = "none" | "pending" | "active" | "failed";
export type CustomDomainSetupStatus = {
    enabled: boolean;
    shopHost: string;
    domain: string | null;
    pendingDomain: string | null;
    activeDomain: string | null;
    dnsStatus: CustomDomainDnsStatus;
    sslStatus: CustomDomainSslStatus;
    verifiedAt: string | null;
    shopUrl: string | null;
    step: "enter" | "verify_dns" | "ssl" | "active";
    dnsHintHost: string;
};
export declare class CustomDomainService {
    static isWizardEnabled(): boolean;
    static getStatus(merchantId: string): Promise<CustomDomainSetupStatus>;
    static startSetup(merchantId: string, rawDomain: string): Promise<CustomDomainSetupStatus>;
    static verifyDns(merchantId: string): Promise<CustomDomainSetupStatus>;
    static refreshSsl(merchantId: string): Promise<CustomDomainSetupStatus>;
    static removeDomain(merchantId: string): Promise<CustomDomainSetupStatus>;
    /** Legacy settings save: mark DNS/SSL as active when domain is set directly. */
    static markLegacyDomainActive(merchantId: string, domain: string | null): Promise<void>;
    static probeSsl(hostname: string): Promise<boolean>;
    static probeSslInBackground(merchantId: string, hostname: string): Promise<void>;
}
//# sourceMappingURL=custom-domain.service.d.ts.map