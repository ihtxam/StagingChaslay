"use strict";
/**
 * DNS checklist for Mailco / Postal sending domains.
 * Exact DKIM / ownership TXT values come from ees.mailco.ch — we document known Postal SPF patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMailcoFromEmail = parseMailcoFromEmail;
exports.mailcoApexDomain = mailcoApexDomain;
exports.isPostalSubdomain = isPostalSubdomain;
exports.postalSubdomainForApex = postalSubdomainForApex;
exports.buildMailcoDnsGuide = buildMailcoDnsGuide;
const DEFAULT_POSTAL_IP = "91.98.126.226";
const DEFAULT_POSTAL_SPF_INCLUDE = "spf.postal.mailco.ch";
const DEFAULT_DKIM_SELECTOR = "postal";
const DEFAULT_DKIM_TARGET = "postal._domainkey.mailco.ch";
function readPostalIp() {
    return (process.env.MAILCO_POSTAL_IP || DEFAULT_POSTAL_IP).trim();
}
function readPostalSpfInclude() {
    return (process.env.MAILCO_POSTAL_SPF_INCLUDE || DEFAULT_POSTAL_SPF_INCLUDE).trim();
}
function readDkimSelector() {
    return (process.env.MAILCO_DKIM_SELECTOR || DEFAULT_DKIM_SELECTOR).trim();
}
function readDkimTarget() {
    return (process.env.MAILCO_DKIM_TARGET || DEFAULT_DKIM_TARGET).trim();
}
/** Split user@host into parts; returns null when invalid. */
function parseMailcoFromEmail(fromEmail) {
    const trimmed = String(fromEmail || "").trim().toLowerCase();
    const at = trimmed.lastIndexOf("@");
    if (at <= 0 || at === trimmed.length - 1)
        return null;
    const local = trimmed.slice(0, at);
    const domain = trimmed.slice(at + 1);
    if (!local || !domain || !domain.includes("."))
        return null;
    return { local, domain };
}
/** Apex domain for Mailco postal subdomains like psrp.example.com → example.com */
function mailcoApexDomain(domain) {
    const labels = String(domain || "")
        .trim()
        .toLowerCase()
        .split(".")
        .filter(Boolean);
    if (labels.length < 2)
        return labels[0] || "";
    if (labels[0] === "psrp" && labels.length >= 3) {
        return labels.slice(1).join(".");
    }
    return labels.slice(-2).join(".");
}
function isPostalSubdomain(domain) {
    const labels = String(domain || "")
        .trim()
        .toLowerCase()
        .split(".")
        .filter(Boolean);
    return labels.length >= 3 && labels[0] === "psrp";
}
function postalSubdomainForApex(apexDomain) {
    return `psrp.${String(apexDomain || "").trim().toLowerCase()}`;
}
function buildMailcoDnsGuide(fromEmail) {
    const parsed = parseMailcoFromEmail(fromEmail);
    if (!parsed)
        return null;
    const sendingDomain = parsed.domain;
    const apexDomain = mailcoApexDomain(sendingDomain);
    const postalSubdomain = isPostalSubdomain(sendingDomain)
        ? sendingDomain
        : postalSubdomainForApex(apexDomain);
    const isPostalFromAddress = isPostalSubdomain(sendingDomain);
    const postalIp = readPostalIp();
    const postalSpfInclude = readPostalSpfInclude();
    const dkimSelector = readDkimSelector();
    const dkimTarget = readDkimTarget();
    const records = [];
    // Apex sending domain (recommended From address host)
    records.push({
        id: "apex-spf",
        purpose: "SPF — allow Mailco Postal to send for your brand domain",
        type: "TXT",
        host: "@",
        value: `v=spf1 include:${postalSpfInclude} ~all`,
        required: true,
        notes: `Add at your DNS provider for ${apexDomain}. Merge with an existing SPF TXT if one already exists (only one SPF record per host).`,
    });
    records.push({
        id: "apex-dkim",
        purpose: "DKIM — sign outbound mail (selector from ees.mailco.ch)",
        type: "CNAME",
        host: `${dkimSelector}._domainkey`,
        value: dkimTarget,
        required: true,
        notes: `Host is relative to ${apexDomain}. Copy the exact selector and target from ees.mailco.ch → Domains → ${apexDomain}.`,
    });
    records.push({
        id: "apex-dmarc",
        purpose: "DMARC — recommended policy (start with p=none)",
        type: "TXT",
        host: "_dmarc",
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${apexDomain}`,
        required: false,
        notes: `Adjust rua to a mailbox you monitor. Tighten to quarantine/reject after SPF and DKIM pass consistently.`,
    });
    records.push({
        id: "apex-verify",
        purpose: "Domain ownership verification (from ees.mailco.ch dashboard)",
        type: "TXT",
        host: "@",
        value: "(copy from ees.mailco.ch → Domains → Verify DNS)",
        required: true,
        notes: "Mailco shows a unique TXT value per domain — paste it here after copying from the dashboard.",
    });
    // Postal return-path subdomain (often psrp.{apex})
    records.push({
        id: "postal-ns",
        purpose: "Postal subdomain delegation (when Mailco hosts DNS for return-path)",
        type: "NS",
        host: "psrp",
        value: "rp.postal.mailco.ch",
        required: false,
        notes: `Only if Mailco instructs NS delegation for ${postalSubdomain}. When delegated, manage SPF below in Mailco Postal / rp.postal.mailco.ch — not at your registrar.`,
    });
    records.push({
        id: "postal-spf",
        purpose: "SPF — Postal return-path subdomain (fixes SPF_NONE / mail-tester)",
        type: "TXT",
        host: "@",
        value: `v=spf1 a mx ip4:${postalIp} ~all`,
        required: true,
        notes: `Add for host ${postalSubdomain} (TXT at @ if editing in Mailco Postal; at registrar use host psrp if not NS-delegated). Sending IP ${postalIp} is postal.mailco.ch.`,
    });
    const recommendations = [];
    if (isPostalFromAddress) {
        recommendations.push(`Your From address uses the Postal return-path subdomain (${sendingDomain}). Prefer a branded address on the apex domain, e.g. noreply@${apexDomain}, configured in Superadmin → Settings → mailco From email and verified in ees.mailco.ch.`);
    }
    recommendations.push(`Verify ${apexDomain} in ees.mailco.ch (Domains → add domain → Verify DNS) before sending production mail.`);
    recommendations.push(`After DNS changes, re-test with mail-tester.com or the Send production-routing test button below. SPF and DKIM should pass; DMARC may report none until you add _dmarc.`);
    if (apexDomain === "rebornsense.com") {
        recommendations.push("rebornsense.com is young for spam filters (FROM_FMBLA_NEWDOM28). An established domain such as chaslay.com (e.g. hello@chaslay.com) may score better once verified in Mailco — only if that domain is your primary brand and has clean DNS history.");
    }
    return {
        fromEmail: parsed.local + "@" + sendingDomain,
        sendingDomain,
        apexDomain,
        postalSubdomain,
        isPostalFromAddress,
        postalIp,
        postalSpfInclude,
        records,
        recommendations,
    };
}
//# sourceMappingURL=mailco-dns-guide.js.map