"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BarcodeService = exports.INTERNAL_BARCODE_LENGTH = exports.INTERNAL_BARCODE_PREFIX = void 0;
exports.isNumericSkuAsBarcode = isNumericSkuAsBarcode;
exports.isSafeSkuAsBarcode = isSafeSkuAsBarcode;
exports.formatInternalBarcode = formatInternalBarcode;
exports.allocateInternalBarcode = allocateInternalBarcode;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const BATCH_CAP = 200;
/** Internal series: 20 + 10 digits (12-digit number, not a GS1 EAN-13). */
exports.INTERNAL_BARCODE_PREFIX = "20";
const INTERNAL_SEQ_DIGITS = 10;
exports.INTERNAL_BARCODE_LENGTH = exports.INTERNAL_BARCODE_PREFIX.length + INTERNAL_SEQ_DIGITS;
const INTERNAL_SEQ_MAX = 10 ** INTERNAL_SEQ_DIGITS - 1;
const INTERNAL_SERIES_RE = /^20\d{10}$/;
function isBlankBarcode(raw) {
    return !String(raw || "").trim();
}
/** Numeric SKU (8–12 digits) may be copied as barcode; never letter prefixes. */
function isNumericSkuAsBarcode(sku) {
    return /^\d{8,12}$/.test(String(sku || "").trim());
}
/** @deprecated Use isNumericSkuAsBarcode — generated codes are digits only. */
function isSafeSkuAsBarcode(sku) {
    return isNumericSkuAsBarcode(sku);
}
function formatInternalBarcode(seq) {
    return `${exports.INTERNAL_BARCODE_PREFIX}${String(seq).padStart(INTERNAL_SEQ_DIGITS, "0")}`;
}
function maxInternalSeq(taken) {
    let maxSeq = 0;
    for (const raw of taken) {
        const code = String(raw || "").trim();
        if (!INTERNAL_SERIES_RE.test(code))
            continue;
        const n = Number(code.slice(exports.INTERNAL_BARCODE_PREFIX.length));
        if (Number.isFinite(n) && n > maxSeq)
            maxSeq = n;
    }
    return maxSeq;
}
/** Allocate the next merchant-unique 12-digit internal barcode (20 + 10 digits). Mutates `taken`. */
function allocateInternalBarcode(taken) {
    let seq = maxInternalSeq(taken);
    for (let i = 0; i < 1000; i++) {
        seq += 1;
        if (seq > INTERNAL_SEQ_MAX)
            return null;
        const candidate = formatInternalBarcode(seq);
        if (!taken.has(candidate)) {
            taken.add(candidate);
            return candidate;
        }
    }
    return null;
}
function normalizeBarcode(raw) {
    const s = String(raw || "").trim();
    return s || null;
}
class BarcodeService {
    static async generateMissing(merchantId, opts) {
        const db = (0, db_1.getDb)();
        const requested = Array.isArray(opts?.productIds)
            ? [...new Set(opts.productIds.map(String).filter(Boolean))].slice(0, BATCH_CAP)
            : [];
        const useSku = opts?.useSku === true;
        const where = [(0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)];
        if (requested.length) {
            where.push((0, drizzle_orm_1.inArray)(db_1.schema.products.id, requested));
        }
        const products = await db.query.products.findMany({
            where: (0, drizzle_orm_1.and)(...where),
            columns: { id: true, barcode: true, sku: true, name: true },
        });
        const missing = products.filter((p) => isBlankBarcode(p.barcode)).slice(0, BATCH_CAP);
        if (!missing.length) {
            return { generated: 0, skipped: products.length, products: [] };
        }
        const existingRows = await db.query.products.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.sql) `${db_1.schema.products.barcode} IS NOT NULL`),
            columns: { barcode: true },
        });
        const taken = new Set(existingRows.map((r) => String(r.barcode || "").trim()).filter(Boolean));
        const updates = [];
        for (const product of missing) {
            let code = null;
            if (useSku && isNumericSkuAsBarcode(product.sku || "")) {
                const sku = String(product.sku).trim();
                if (!taken.has(sku))
                    code = sku;
            }
            if (!code) {
                code = allocateInternalBarcode(taken);
            }
            else {
                taken.add(code);
            }
            if (!code)
                continue;
            updates.push({ id: product.id, barcode: code });
        }
        const saved = [];
        for (const row of updates) {
            const updated = await db
                .update(db_1.schema.products)
                .set({ barcode: row.barcode, updatedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, row.id), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(db_1.schema.products.barcode), (0, drizzle_orm_1.eq)(db_1.schema.products.barcode, ""), (0, drizzle_orm_1.sql) `btrim(${db_1.schema.products.barcode}) = ''`)))
                .returning({ id: db_1.schema.products.id, barcode: db_1.schema.products.barcode });
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
    static normalizeForSave(raw) {
        return normalizeBarcode(raw);
    }
    /** Allocate a merchant-unique internal barcode (products + inventory items). */
    static async allocateForStorekeeper(merchantId) {
        const db = (0, db_1.getDb)();
        const [productRows, inventoryRows] = await Promise.all([
            db.query.products.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.sql) `${db_1.schema.products.barcode} IS NOT NULL`),
                columns: { barcode: true },
            }),
            db.query.inventoryItems.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.inventoryItems.merchantId, merchantId), (0, drizzle_orm_1.sql) `${db_1.schema.inventoryItems.barcode} IS NOT NULL`),
                columns: { barcode: true },
            }),
        ]);
        const taken = new Set();
        for (const row of productRows) {
            const code = String(row.barcode || "").trim();
            if (code)
                taken.add(code);
        }
        for (const row of inventoryRows) {
            const code = String(row.barcode || "").trim();
            if (code)
                taken.add(code);
        }
        const code = allocateInternalBarcode(taken);
        if (!code)
            throw new Error("Could not allocate barcode — internal series exhausted");
        return code;
    }
}
exports.BarcodeService = BarcodeService;
//# sourceMappingURL=barcode.service.js.map