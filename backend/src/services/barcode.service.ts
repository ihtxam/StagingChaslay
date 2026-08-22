import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const BATCH_CAP = 200;

/** Internal series: 20 + 10 digits (12-digit number, not a GS1 EAN-13). */
export const INTERNAL_BARCODE_PREFIX = "20";
const INTERNAL_SEQ_DIGITS = 10;
export const INTERNAL_BARCODE_LENGTH =
  INTERNAL_BARCODE_PREFIX.length + INTERNAL_SEQ_DIGITS;
const INTERNAL_SEQ_MAX = 10 ** INTERNAL_SEQ_DIGITS - 1;
const INTERNAL_SERIES_RE = /^20\d{10}$/;

function isBlankBarcode(raw?: string | null): boolean {
  return !String(raw || "").trim();
}

/** Numeric SKU (8–12 digits) may be copied as barcode; never letter prefixes. */
export function isNumericSkuAsBarcode(sku: string): boolean {
  return /^\d{8,12}$/.test(String(sku || "").trim());
}

/** @deprecated Use isNumericSkuAsBarcode — generated codes are digits only. */
export function isSafeSkuAsBarcode(sku: string): boolean {
  return isNumericSkuAsBarcode(sku);
}

export function formatInternalBarcode(seq: number): string {
  return `${INTERNAL_BARCODE_PREFIX}${String(seq).padStart(INTERNAL_SEQ_DIGITS, "0")}`;
}

function maxInternalSeq(taken: Iterable<string>): number {
  let maxSeq = 0;
  for (const raw of taken) {
    const code = String(raw || "").trim();
    if (!INTERNAL_SERIES_RE.test(code)) continue;
    const n = Number(code.slice(INTERNAL_BARCODE_PREFIX.length));
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
  }
  return maxSeq;
}

/** Allocate the next merchant-unique 12-digit internal barcode (20 + 10 digits). Mutates `taken`. */
export function allocateInternalBarcode(taken: Set<string>): string | null {
  let seq = maxInternalSeq(taken);
  for (let i = 0; i < 1000; i++) {
    seq += 1;
    if (seq > INTERNAL_SEQ_MAX) return null;
    const candidate = formatInternalBarcode(seq);
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
  return null;
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
      if (useSku && isNumericSkuAsBarcode(product.sku || "")) {
        const sku = String(product.sku).trim();
        if (!taken.has(sku)) code = sku;
      }
      if (!code) {
        code = allocateInternalBarcode(taken);
      } else {
        taken.add(code);
      }
      if (!code) continue;
      updates.push({ id: product.id, barcode: code });
    }

    const saved: Array<{ id: string; barcode: string }> = [];
    for (const row of updates) {
      const updated = await db
        .update(schema.products)
        .set({ barcode: row.barcode, updatedAt: new Date() })
        .where(
          and(
            eq(schema.products.id, row.id),
            eq(schema.products.merchantId, merchantId),
            or(
              isNull(schema.products.barcode),
              eq(schema.products.barcode, ""),
              sql`btrim(${schema.products.barcode}) = ''`
            )
          )
        )
        .returning({ id: schema.products.id, barcode: schema.products.barcode });
      if (updated[0]?.barcode) {
        saved.push({ id: updated[0].id, barcode: String(updated[0].barcode) });
      }
    }

    return {
      generated: saved.length,
      skipped: products.length - missing.length,
      products: saved,
    };
  }

  static normalizeForSave(raw?: string | null): string | null {
    return normalizeBarcode(raw);
  }
}
