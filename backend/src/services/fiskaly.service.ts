import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
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
      return null;
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

  static toPushResponse(sig: FiskalySignature | null): FiskalySignResponse | undefined {
    if (!sig) return undefined;
    return {
      qrCodeData: sig.qrCodeData,
      signature: sig.signature,
      txNumber: sig.txNumber,
      txId: sig.txId,
    };
  }
}
