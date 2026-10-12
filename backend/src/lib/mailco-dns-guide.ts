/**
 * DNS checklist for Mailco / Postal sending domains.
 * Exact DKIM / ownership TXT values come from ees.mailco.ch — we document known Postal SPF patterns.
 *
 * Gmail evaluates SPF on the envelope (Return-Path), not header From.
 * Postal uses `psrp.{apex}` as MAIL FROM and CNAMEs it to `rp.postal.mailco.ch`.
 * A TXT cannot sit on a CNAME, so SPF must be published on the CNAME target
 * (and on the include host `spf.postal.mailco.ch`).
 */

export type MailcoDnsRecord = {
  id: string;
  purpose: string;
  type: "TXT" | "CNAME" | "NS";
  host: string;
  value: string;
  required: boolean;
  zone: string;
  notes?: string;
};

export type MailcoDnsGuide = {
  fromEmail: string;
  sendingDomain: string;
  apexDomain: string;
  postalSubdomain: string | null;
  isPostalFromAddress: boolean;
  postalIp: string;
  postalIpv6: string;
  postalSpfInclude: string;
  returnPathHost: string;
  records: MailcoDnsRecord[];
  recommendations: string[];
};

export type PostalSpfOptions = {
  ipv4?: string;
  ipv6?: string;
  include?: string;
};

export const DEFAULT_POSTAL_IPV4 = "91.98.126.226";
export const DEFAULT_POSTAL_IPV6 = "2a01:4f8:1c1a:82d4::1";
export const DEFAULT_POSTAL_SPF_INCLUDE = "spf.postal.mailco.ch";
export const DEFAULT_RETURN_PATH_HOST = "rp.postal.mailco.ch";
const DEFAULT_DKIM_SELECTOR = "postal";
const DEFAULT_DKIM_TARGET = "postal._domainkey.mailco.ch";

function readPostalIp(): string {
  return (process.env.MAILCO_POSTAL_IP || DEFAULT_POSTAL_IPV4).trim();
}

function readPostalIpv6(): string {
  return (process.env.MAILCO_POSTAL_IPV6 || DEFAULT_POSTAL_IPV6).trim();
}

function readPostalSpfInclude(): string {
  return (process.env.MAILCO_POSTAL_SPF_INCLUDE || DEFAULT_POSTAL_SPF_INCLUDE).trim();
}

function readReturnPathHost(): string {
  return (process.env.MAILCO_RETURN_PATH_HOST || DEFAULT_RETURN_PATH_HOST).trim();
}

function readDkimSelector(): string {
  return (process.env.MAILCO_DKIM_SELECTOR || DEFAULT_DKIM_SELECTOR).trim();
}

function readDkimTarget(): string {
  return (process.env.MAILCO_DKIM_TARGET || DEFAULT_DKIM_TARGET).trim();
}

/** Split user@host into parts; returns null when invalid. */
export function parseMailcoFromEmail(fromEmail: string): { local: string; domain: string } | null {
  const trimmed = String(fromEmail || "").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!local || !domain || !domain.includes(".")) return null;
  return { local, domain };
}

/** Apex domain for Mailco postal subdomains like psrp.example.com → example.com */
export function mailcoApexDomain(domain: string): string {
  const labels = String(domain || "")
    .trim()
    .toLowerCase()
    .split(".")
    .filter(Boolean);
  if (labels.length < 2) return labels[0] || "";
  if (labels[0] === "psrp" && labels.length >= 3) {
    return labels.slice(1).join(".");
  }
  return labels.slice(-2).join(".");
}

export function isPostalSubdomain(domain: string): boolean {
  const labels = String(domain || "")
    .trim()
    .toLowerCase()
    .split(".")
    .filter(Boolean);
  return labels.length >= 3 && labels[0] === "psrp";
}

export function postalSubdomainForApex(apexDomain: string): string {
  return `psrp.${String(apexDomain || "").trim().toLowerCase()}`;
}

/**
 * Self-contained SPF that authorizes the Postal relay (postal.mailco.ch).
 * Used on `spf.postal.mailco.ch` and on `rp.postal.mailco.ch`.
 * Explicit ip4/ip6 — do not use `a`/`mx` on rp.* (those A/AAAA are Cloudflare proxies).
 */
export function buildPostalSenderSpfRecord(options: PostalSpfOptions = {}): string {
  const ipv4 = (options.ipv4 ?? readPostalIp()).trim();
  const ipv6 = (options.ipv6 ?? readPostalIpv6()).trim();
  const parts = ["v=spf1"];
  if (ipv4) parts.push(`ip4:${ipv4}`);
  if (ipv6) parts.push(`ip6:${ipv6}`);
  parts.push("~all");
  return parts.join(" ");
}

/** Apex / brand-domain SPF: include the Mailco Postal include host. */
export function buildPostalIncludeSpfRecord(options: PostalSpfOptions = {}): string {
  const include = (options.include ?? readPostalSpfInclude()).trim();
  return `v=spf1 include:${include} ~all`;
}

export function buildMailcoDnsGuide(fromEmail: string): MailcoDnsGuide | null {
  const parsed = parseMailcoFromEmail(fromEmail);
  if (!parsed) return null;

  const sendingDomain = parsed.domain;
  const apexDomain = mailcoApexDomain(sendingDomain);
  const postalSubdomain = isPostalSubdomain(sendingDomain)
    ? sendingDomain
    : postalSubdomainForApex(apexDomain);
  const isPostalFromAddress = isPostalSubdomain(sendingDomain);
  const postalIp = readPostalIp();
  const postalIpv6 = readPostalIpv6();
  const postalSpfInclude = readPostalSpfInclude();
  const returnPathHost = readReturnPathHost();
  const dkimSelector = readDkimSelector();
  const dkimTarget = readDkimTarget();
  const senderSpf = buildPostalSenderSpfRecord({ ipv4: postalIp, ipv6: postalIpv6 });
  const includeSpf = buildPostalIncludeSpfRecord({ include: postalSpfInclude });
  const includeHostLabel = postalSpfInclude.replace(/\.mailco\.ch$/i, "") || "spf.postal";

  const records: MailcoDnsRecord[] = [];

  // Mailco infra — Gmail SPF is evaluated here after CNAME follow
  records.push({
    id: "mailco-include-spf",
    purpose: "SPF include host — authorize postal.mailco.ch IPv4 + IPv6",
    type: "TXT",
    host: includeHostLabel,
    value: senderSpf,
    required: true,
    zone: "mailco.ch",
    notes:
      `Publish in the mailco.ch Cloudflare zone (FQDN ${postalSpfInclude}). ` +
      `Apex sending domains include this host. Live lookups were empty on 12 Oct 2026.`,
  });

  records.push({
    id: "mailco-rp-spf",
    purpose: "SPF — Postal return-path (fixes Gmail SPF NONE on *@psrp.*)",
    type: "TXT",
    host: "rp.postal",
    value: senderSpf,
    required: true,
    zone: "mailco.ch",
    notes:
      `Publish in the mailco.ch Cloudflare zone (FQDN ${returnPathHost}). ` +
      `psrp.* CNAMEs here, so Gmail evaluates this TXT for smtp.mailfrom. ` +
      `Do not use a/mx — A/AAAA on ${returnPathHost} are Cloudflare proxies, not the relay.`,
  });

  // Brand / merchant sending domain
  records.push({
    id: "apex-spf",
    purpose: "SPF — allow Mailco Postal to send for your brand domain",
    type: "TXT",
    host: "@",
    value: includeSpf,
    required: true,
    zone: apexDomain,
    notes: `Add at your DNS provider for ${apexDomain}. Merge with an existing SPF TXT if one already exists (only one SPF record per host).`,
  });

  records.push({
    id: "apex-dkim",
    purpose: "DKIM — sign outbound mail (selector from ees.mailco.ch)",
    type: "CNAME",
    host: `${dkimSelector}._domainkey`,
    value: dkimTarget,
    required: true,
    zone: apexDomain,
    notes: `Host is relative to ${apexDomain}. Copy the exact selector and target from ees.mailco.ch → Domains → ${apexDomain}.`,
  });

  records.push({
    id: "apex-dmarc",
    purpose: "DMARC — recommended policy (start with p=none)",
    type: "TXT",
    host: "_dmarc",
    value: `v=DMARC1; p=none; rua=mailto:dmarc@${apexDomain}`,
    required: false,
    zone: apexDomain,
    notes: `Adjust rua to a mailbox you monitor. Tighten to quarantine/reject after SPF and DKIM pass consistently.`,
  });

  records.push({
    id: "apex-verify",
    purpose: "Domain ownership verification (from ees.mailco.ch dashboard)",
    type: "TXT",
    host: "@",
    value: "(copy from ees.mailco.ch → Domains → Verify DNS)",
    required: true,
    zone: apexDomain,
    notes: "Mailco shows a unique TXT value per domain — paste it here after copying from the dashboard.",
  });

  // Merchant / platform return-path: CNAME, not a TXT (CNAME cannot coexist with SPF)
  records.push({
    id: "postal-cname",
    purpose: "Postal return-path CNAME (psrp → rp.postal.mailco.ch)",
    type: "CNAME",
    host: "psrp",
    value: returnPathHost,
    required: true,
    zone: apexDomain,
    notes:
      `Postal MAIL FROM is *@${postalSubdomain}. Keep this CNAME. ` +
      `Do not add a TXT on ${postalSubdomain} while the CNAME exists — SPF is inherited from ${returnPathHost}.`,
  });

  records.push({
    id: "postal-spf",
    purpose: "SPF fallback — only if psrp is NOT a CNAME",
    type: "TXT",
    host: "psrp",
    value: senderSpf,
    required: false,
    zone: apexDomain,
    notes:
      `Skip when ${postalSubdomain} is a CNAME to ${returnPathHost} (the live Reborn setup). ` +
      `mail-tester often suggests this TXT on the CNAME name — ignore that. ` +
      `Use this TXT only if you publish SPF directly on the return-path host instead of CNAME.`,
  });

  const recommendations: string[] = [];

  recommendations.push(
    `Gmail SPF NONE on receipt mail is evaluated on ${postalSubdomain} → ${returnPathHost}. ` +
      `Publish TXT ${senderSpf} on both ${returnPathHost} and ${postalSpfInclude} in the mailco.ch Cloudflare zone.`
  );

  recommendations.push(
    `mail-tester.com advice to add TXT on ${postalSubdomain} is WRONG while that name is a CNAME to ${returnPathHost}. ` +
      `A CNAME cannot have its own TXT. Keep the CNAME and publish SPF on ${returnPathHost} and ${postalSpfInclude} instead.`
  );

  if (isPostalFromAddress) {
    recommendations.push(
      `Your From address uses the Postal return-path subdomain (${sendingDomain}). Prefer a branded address on the apex domain, e.g. noreply@${apexDomain}, configured in Superadmin → Settings → mailco From email and verified in ees.mailco.ch.`
    );
  }

  recommendations.push(
    `Verify ${apexDomain} in ees.mailco.ch (Domains → add domain → Verify DNS) before sending production mail.`
  );

  recommendations.push(
    `After DNS changes, wait for TTL (psrp CNAME is ~300s; Cloudflare NODATA for rp TXT is often 30 minutes). Then re-test with mail-tester.com or the Send production-routing test. Gmail may cache SPF NONE until its resolver TTL expires.`
  );

  if (apexDomain === "rebornsense.com") {
    recommendations.push(
      "rebornsense.com is young for spam filters (FROM_FMBLA_NEWDOM28). An established domain such as chaslay.com (e.g. hello@chaslay.com) may score better once verified in Mailco — only if that domain is your primary brand and has clean DNS history."
    );
  }

  return {
    fromEmail: parsed.local + "@" + sendingDomain,
    sendingDomain,
    apexDomain,
    postalSubdomain,
    isPostalFromAddress,
    postalIp,
    postalIpv6,
    postalSpfInclude,
    returnPathHost,
    records,
    recommendations,
  };
}
