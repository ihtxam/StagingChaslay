import https from "node:https";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { schema } from "@/db/schema";
import { resolveShopPublicHost } from "@/lib/brand";
import { verifyCustomDomainDns } from "@/lib/custom-domain-dns";
import {
  isValidCustomDomainHost,
  normalizeCustomDomainHost,
} from "@/lib/domain";

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

function normalizeDnsStatus(raw?: string | null): CustomDomainDnsStatus {
  const v = String(raw || "none").toLowerCase();
  if (v === "pending" || v === "verified" || v === "failed") return v;
  return "none";
}

function normalizeSslStatus(raw?: string | null): CustomDomainSslStatus {
  const v = String(raw || "none").toLowerCase();
  if (v === "pending" || v === "active" || v === "failed") return v;
  return "none";
}

function dnsHintHost(domain: string): string {
  const parts = domain.split(".").filter(Boolean);
  if (parts.length <= 2) return "www";
  return parts[0] || "www";
}

function deriveStep(
  pending: string | null,
  active: string | null,
  dns: CustomDomainDnsStatus,
  ssl: CustomDomainSslStatus
): CustomDomainSetupStatus["step"] {
  if (active && !pending) {
    if (dns === "verified" && ssl === "active") return "active";
    // Legacy merchants saved customDomain before wizard status columns existed.
    if (dns === "none" && (ssl === "none" || ssl === "active")) return "active";
    if (dns === "verified" && ssl === "pending") return "ssl";
  }
  if (pending && dns !== "verified") return "verify_dns";
  if (pending || active) return "verify_dns";
  return "enter";
}

function mapMerchantToStatus(
  merchant: Pick<
    typeof schema.merchants.$inferSelect,
    | "customDomain"
    | "customDomainPending"
    | "customDomainDnsStatus"
    | "customDomainSslStatus"
    | "customDomainVerifiedAt"
  >
): CustomDomainSetupStatus {
  const shopHost = resolveShopPublicHost();
  const pending = merchant.customDomainPending || null;
  const active = merchant.customDomain || null;
  const dnsStatus = normalizeDnsStatus(merchant.customDomainDnsStatus);
  const sslStatus = normalizeSslStatus(merchant.customDomainSslStatus);
  const domain = active || pending;
  const verifiedAt = merchant.customDomainVerifiedAt
    ? new Date(merchant.customDomainVerifiedAt).toISOString()
    : null;

  return {
    enabled: true,
    shopHost,
    domain,
    pendingDomain: pending,
    activeDomain: active,
    dnsStatus,
    sslStatus,
    verifiedAt,
    shopUrl: active ? `https://${active}` : null,
    step: deriveStep(pending, active, dnsStatus, sslStatus),
    dnsHintHost: domain ? dnsHintHost(domain) : "www",
  };
}

async function assertDomainAvailable(domain: string, merchantId: string): Promise<void> {
  const db = getDb();
  const taken = await db.query.merchants.findFirst({
    where: eq(schema.merchants.customDomain, domain),
    columns: { id: true },
  });
  if (taken && taken.id !== merchantId) {
    throw new Error("Custom domain already in use");
  }

  const pendingTaken = await db.query.merchants.findFirst({
    where: eq(schema.merchants.customDomainPending, domain),
    columns: { id: true },
  });
  if (pendingTaken && pendingTaken.id !== merchantId) {
    throw new Error("Custom domain already in use");
  }
}

function scheduleSslProbe(merchantId: string, hostname: string): void {
  setImmediate(() => {
    void CustomDomainService.probeSslInBackground(merchantId, hostname);
  });
}

export class CustomDomainService {
  static isWizardEnabled(): boolean {
    return process.env.CUSTOM_DOMAIN_WIZARD_ENABLED !== "0";
  }

  static async getStatus(merchantId: string): Promise<CustomDomainSetupStatus> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        customDomain: true,
        customDomainPending: true,
        customDomainDnsStatus: true,
        customDomainSslStatus: true,
        customDomainVerifiedAt: true,
      },
    });
    if (!merchant) throw new Error("Merchant not found");

    const status = mapMerchantToStatus(merchant);
    status.enabled = this.isWizardEnabled();

    if (
      status.activeDomain &&
      status.dnsStatus === "verified" &&
      status.sslStatus === "pending"
    ) {
      scheduleSslProbe(merchantId, status.activeDomain);
    }

    return status;
  }

  static async startSetup(merchantId: string, rawDomain: string): Promise<CustomDomainSetupStatus> {
    const domain = normalizeCustomDomainHost(rawDomain);
    if (!domain || !isValidCustomDomainHost(domain)) {
      throw new Error("Enter a valid domain (e.g. www.mycafe.ch)");
    }

    await assertDomainAvailable(domain, merchantId);

    const db = getDb();
    await db
      .update(schema.merchants)
      .set({
        customDomainPending: domain,
        customDomainDnsStatus: "pending",
        customDomainSslStatus: "none",
        customDomainVerifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId));

    return this.getStatus(merchantId);
  }

  static async verifyDns(merchantId: string): Promise<CustomDomainSetupStatus> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        customDomainPending: true,
        customDomain: true,
      },
    });
    if (!merchant) throw new Error("Merchant not found");

    const hostname = merchant.customDomainPending || merchant.customDomain;
    if (!hostname) {
      throw new Error("Add a domain before verifying DNS");
    }

    const result = await verifyCustomDomainDns(hostname);
    if (!result.ok) {
      await db
        .update(schema.merchants)
        .set({
          customDomainDnsStatus: "failed",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId));
      throw new Error(
        `DNS not ready yet. Point a CNAME for ${hostname} to ${resolveShopPublicHost()} and try again.`
      );
    }

    await assertDomainAvailable(hostname, merchantId);

    const now = new Date();
    await db
      .update(schema.merchants)
      .set({
        customDomain: hostname,
        customDomainPending: null,
        customDomainDnsStatus: "verified",
        customDomainSslStatus: "pending",
        customDomainVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.merchants.id, merchantId));

    scheduleSslProbe(merchantId, hostname);
    return this.getStatus(merchantId);
  }

  static async refreshSsl(merchantId: string): Promise<CustomDomainSetupStatus> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { customDomain: true, customDomainDnsStatus: true },
    });
    if (!merchant?.customDomain || merchant.customDomainDnsStatus !== "verified") {
      throw new Error("Verify DNS before checking SSL");
    }

    const ok = await this.probeSsl(merchant.customDomain);
    await db
      .update(schema.merchants)
      .set({
        customDomainSslStatus: ok ? "active" : "pending",
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId));

    return this.getStatus(merchantId);
  }

  static async removeDomain(merchantId: string): Promise<CustomDomainSetupStatus> {
    const db = getDb();
    await db
      .update(schema.merchants)
      .set({
        customDomain: null,
        customDomainPending: null,
        customDomainDnsStatus: "none",
        customDomainSslStatus: "none",
        customDomainVerifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId));

    return this.getStatus(merchantId);
  }

  /** Legacy settings save: mark DNS/SSL as active when domain is set directly. */
  static async markLegacyDomainActive(merchantId: string, domain: string | null): Promise<void> {
    const db = getDb();
    if (!domain) {
      await db
        .update(schema.merchants)
        .set({
          customDomain: null,
          customDomainPending: null,
          customDomainDnsStatus: "none",
          customDomainSslStatus: "none",
          customDomainVerifiedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId));
      return;
    }

    await db
      .update(schema.merchants)
      .set({
        customDomain: domain,
        customDomainPending: null,
        customDomainDnsStatus: "verified",
        customDomainSslStatus: "active",
        customDomainVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId));
  }

  static probeSsl(hostname: string): Promise<boolean> {
    return new Promise((resolve) => {
      const req = https.request(
        {
          host: hostname,
          port: 443,
          method: "HEAD",
          path: "/",
          timeout: 8000,
          rejectUnauthorized: true,
        },
        (res) => {
          res.resume();
          resolve((res.statusCode || 0) < 500);
        }
      );
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
      req.end();
    });
  }

  static async probeSslInBackground(merchantId: string, hostname: string): Promise<void> {
    const ok = await this.probeSsl(hostname);
    if (!ok) return;

    const db = getDb();
    await db
      .update(schema.merchants)
      .set({
        customDomainSslStatus: "active",
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId));
  }
}
