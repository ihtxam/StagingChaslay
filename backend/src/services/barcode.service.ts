import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const BATCH_CAP = 200;
const INTERNAL_PREFIX = "C";
const INTERNAL_DIGITS = 11;

function isBlankBarcode(raw?: string | null): boolean {
  return !String(raw || "").trim();
}

/** Code128-B safe internal / SKU values — never a fake EAN-13. */
export function isSafeSkuAsBarcode(sku: string): boolean {
  const s = String(sku || "").trim();
  if (s.length < 1 || s.length > 20) return false;
  if (!/^[\x21-\x7E]+$/.test(s)) return false;
  return true;
}

function randomInternalCode(): string {
  let digits = "";
  for (let i = 0; i < INTERNAL_DIGITS; i++) {
    digits += String(Math.floor(Math.random() * 10));
  }
  return `${INTERNAL_PREFIX}${digits}`;
}

function normalizeBarcode(raw?: string | null): string | null {
  const s = String(raw || "").trim();
  return s || null;
}

export class BarcodeService {
  static async generateMissing(
    merchantId: string,
    opts?: { productIds?: string[]; useSku?: boolean }
  ) {
    const db = getDb();
    const requested = Array.isArray(opts?.productIds)
      ? [...new Set(opts!.productIds.map(String).filter(Boolean))].slice(0, BATCH_CAP)
      : [];
    const useSku = opts?.useSku === true;

    const where = [eq(schema.products.merchantId, merchantId)];
    if (requested.length) {
      where.push(inArray(schema.products.id, requested));
    }

    const products = await db.query.products.findMany({
      where: and(...where),
      columns: { id: true, barcode: true, sku: true, name: true },
    });

    const missing = products.filter((p) => isBlankBarcode(p.barcode)).slice(0, BATCH_CAP);
    if (!missing.length) {
      return { generated: 0, skipped: products.length, products: [] as Array<{ id: string; barcode: string }> };
    }

    const existingRows = await db.query.products.findMany({
      where: and(eq(schema.products.merchantId, merchantId), sql`${schema.products.barcode} IS NOT NULL`),
      columns: { barcode: true },
    });
    const taken = new Set(
      existingRows.map((r) => String(r.barcode || "").trim()).filter(Boolean)
    );

    const updates: Array<{ id: string; barcode: string }> = [];
    for (const product of missing) {
      let code: string | null = null;
      if (useSku && isSafeSkuAsBarcode(product.sku || "")) {
        const sku = String(product.sku).trim();
        if (!taken.has(sku)) code = sku;
      }
      if (!code) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const candidate = randomInternalCode();
          if (!taken.has(candidate)) {
            code = candidate;
            break;
          }
        }
      }
      if (!code) continue;
      taken.add(code);
      updates.push({ id: product.id, barcode: code });
    }

    for (const row of updates) {
      await db
        .update(schema.products)
        .set({ barcode: row.barcode, updatedAt: new Date() })
        .where(
          and(
            eq(schema.products.id, row.id),
            eq(schema.products.merchantId, merchantId),
            or(isNull(schema.products.barcode), eq(schema.products.barcode, ""))
          )
        );
    }

    return {
      generated: updates.length,
      skipped: products.length - missing.length,
      products: updates,
    };
  }

  static normalizeForSave(raw?: string | null): string | null {
    return normalizeBarcode(raw);
  }
}
