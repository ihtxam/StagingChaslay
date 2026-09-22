/**
 * DNS checklist for Mailco / Postal sending domains.
 * Exact DKIM / ownership TXT values come from ees.mailco.ch — we document known Postal SPF patterns.
 */
export type MailcoDnsRecord = {
    id: string;
    purpose: string;
    type: "TXT" | "CNAME" | "NS";
    host: string;
    value: string;
    required: boolean;
    notes?: string;
};
export type MailcoDnsGuide = {
    fromEmail: string;
    sendingDomain: string;
    apexDomain: string;
    postalSubdomain: string | null;
    isPostalFromAddress: boolean;
    postalIp: string;
    postalSpfInclude: string;
    records: MailcoDnsRecord[];
    recommendations: string[];
};
/** Split user@host into parts; returns null when invalid. */
export declare function parseMailcoFromEmail(fromEmail: string): {
    local: string;
    domain: string;
} | null;
/** Apex domain for Mailco postal subdomains like psrp.example.com → example.com */
export declare function mailcoApexDomain(domain: string): string;
export declare function isPostalSubdomain(domain: string): boolean;
export declare function postalSubdomainForApex(apexDomain: string): string;
export declare function buildMailcoDnsGuide(fromEmail: string): MailcoDnsGuide | null;
//# sourceMappingURL=mailco-dns-guide.d.ts.map