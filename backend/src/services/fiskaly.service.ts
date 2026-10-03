import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
  getFiskalyPublic,
  mergeFiskalySettings,
  normalizeCountry,
  normalizeFiskalySettings,
  type FiskalySettings,
  type FiskalySignature,
} from "@/lib/fiskaly-settings";
import { FiskalyDeService } from "@/services/fiskaly-de.service";
import { FiskalyFrService } from "@/services/fiskaly-fr.service";

export { normalizeCountry } from "@/lib/fiskaly-settings";

export type FiskalyPosSalePayload = {
  total: number;
  subtotal?: number;
  taxAmount?: number;
  paymentMethod?: string | null;
  paymentBreakdown?: Array<{ method: string; amount: number }> | null;
  orderNumber?: string | null;
  items?: Array<{
    productName?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    taxAmount?: number;
    taxRate?: number;
  }>;
};

export type FiskalySignResponse = {
  qrCodeData?: string | null;
  signature?: string | null;
  txNumber?: string | number | null;
  txId?: string | null;
};

async function loadMerchantFiskaly(merchantId: string) {
  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: { country: true, fiskalySettings: true },
  });
  if (!merchant) throw new Error("Merchant not found");
  const country = normalizeCountry(merchant.country);
  const settings = normalizeFiskalySettings(
    (merchant as { fiskalySettings?: FiskalySettings | null }).fiskalySettings
  );
  return { country, settings };
}

export class FiskalyService {
  static normalizeCountry(country?: string | null) {
    return normalizeCountry(country);
  }

  static async signPosSale(
    merchantId: string,
    orderId: string,
    sale: FiskalyPosSalePayload
  ): Promise<FiskalySignature | null> {
    const { country, settings } = await loadMerchantFiskaly(merchantId);
    if (!settings.enabled || !country) return null;

    let signature: FiskalySignature | null = null;

    if (country === "DE" && settings.de?.apiKey && settings.de?.apiSecret) {
      const result = await FiskalyDeService.signTransaction({
        de: settings.de,
        environment: settings.environment || "test",
        sale,
      });
      signature = {
        country: "DE",
        qrCodeData: result.qrCodeData,
        signature: result.signature,
        txNumber: result.txNumber,
        txId: result.txId,
        tssSerial: result.tssSerial,
        signedAt: new Date().toISOString(),
        raw: result.raw,
      };
    } else if (country === "FR" && settings.fr?.apiKey && settings.fr?.apiSecret) {
      const result = await FiskalyFrService.signTransaction({
        fr: settings.fr,
        environment: settings.environment || "test",
        sale,
      });
      signature = {
        country: "FR",
        qrCodeData: result.qrCodeData,
        signature: result.signature,
        txNumber: result.txNumber,
        txId: result.txId,
        signedAt: new Date().toISOString(),
        raw: result.raw,
      };
    } else {
      throw new Error(
        country === "DE"
          ? "Fiskaly DE is enabled but credentials or TSS/client IDs are incomplete"
          : "Fiskaly FR is enabled but credentials are incomplete"
      );
    }

    const db = getDb();
    await db
      .update(schema.orders)
      .set({ fiskalySignature: signature })
      .where(eq(schema.orders.id, orderId));

    return signature;
  }

  static async signPosRefund(
    merchantId: string,
    orderId: string,
    _refundPayload: Record<string, unknown>
  ): Promise<FiskalySignature | null> {
    const { country, settings } = await loadMerchantFiskaly(merchantId);
    if (!settings.enabled || !country) return null;
    console.warn("[fiskaly] signPosRefund not implemented for MVP", { merchantId, orderId, country });
    return null;
  }

  static async testConnection(merchantId: string, country: "DE" | "FR"): Promise<void> {
    const { settings } = await loadMerchantFiskaly(merchantId);
    const env = settings.environment || "test";
    if (country === "DE") {
      await FiskalyDeService.testConnection(settings.de || {}, env);
      return;
    }
    if (country === "FR") {
      await FiskalyFrService.testConnection(settings.fr || {}, env);
      return;
    }
    throw new Error("Unsupported country");
  }

  static async provisionDe(
    merchantId: string,
    opts?: { clientSerial?: string; description?: string }
  ): Promise<ReturnType<typeof getFiskalyPublic>> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { country: true, fiskalySettings: true, name: true },
    });
    if (!merchant) throw new Error("Merchant not found");
    if (normalizeCountry(merchant.country) !== "DE") {
      throw new Error("Fiskaly SIGN DE provisioning is only for Germany merchants");
    }
    const settings = normalizeFiskalySettings(
      (merchant as { fiskalySettings?: FiskalySettings | null }).fiskalySettings
    );
    if (!settings.de?.apiKey || !settings.de?.apiSecret) {
      throw new Error("Save API key and secret before provisioning TSS");
    }
    const env = settings.environment || "test";
    const provisioned = await FiskalyDeService.provisionCloudTssAndClient(
      settings.de,
      env,
      {
        clientSerial: opts?.clientSerial,
        description: opts?.description || `${merchant.name || "Reborn POS"} TSS`,
      }
    );
    const merged = mergeFiskalySettings(settings, {
      enabled: true,
      de: {
        tssId: provisioned.tssId,
        clientId: provisioned.clientId,
        clientSerial: provisioned.clientSerial,
        adminPin: provisioned.adminPin,
      },
    });
    await db
      .update(schema.merchants)
      .set({ fiskalySettings: merged, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    return getFiskalyPublic(merged);
  }

  static toPushResponse(sig: FiskalySignature | null): FiskalySignResponse | undefined {
    if (!sig) return undefined;
    return {
      qrCodeData: sig.qrCodeData,
      signature: sig.signature,
      txNumber: sig.txNumber,
      txId: sig.txId,
    };
  }

  /** Sign a completed POS sale pushed via /sync/push-sales when Fiskaly is enabled. */
  static async maybeSignSyncedPosSale(
    merchantId: string,
    orderId: string,
    sale: FiskalyPosSalePayload
  ): Promise<FiskalySignResponse | undefined> {
    const sig = await this.signPosSale(merchantId, orderId, sale);
    return this.toPushResponse(sig);
  }
}
