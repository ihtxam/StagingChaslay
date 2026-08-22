"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductPhotoImportService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const media_upload_service_1 = require("@/services/media-upload.service");
/** Royalty-free food photos via Foodish API (https://foodish-api.com). */
const FOODISH_CATEGORIES = [
    'biryani',
    'burger',
    'butter-chicken',
    'dessert',
    'dosa',
    'idly',
    'pasta',
    'pizza',
    'rice',
    'samosa',
];
function guessCategory(name) {
    const n = String(name || '').toLowerCase();
    if (/pizza|margherita|calzone/.test(n))
        return 'pizza';
    if (/burger|hamburger|cheeseburger/.test(n))
        return 'burger';
    if (/pasta|spaghetti|penne|lasagna|lasagne|ravioli/.test(n))
        return 'pasta';
    if (/biryani|curry|rice|risotto|paella/.test(n))
        return 'biryani';
    if (/dosa|idli|idly|samosa|indian/.test(n))
        return 'dosa';
    if (/dessert|cake|tiramisu|ice.?cream|chocolate|sweet/.test(n))
        return 'dessert';
    if (/chicken|butter/.test(n))
        return 'butter-chicken';
    if (/samosa/.test(n))
        return 'samosa';
    return FOODISH_CATEGORIES[Math.floor(Math.random() * FOODISH_CATEGORIES.length)];
}
async function fetchFoodishImage(category) {
    const urls = [
        `https://foodish-api.com/images/${category}/${category}${1 + Math.floor(Math.random() * 80)}.jpg`,
        'https://foodish-api.com/api/',
    ];
    for (const url of urls) {
        try {
            const res = await fetch(url, { redirect: 'follow' });
            if (!res.ok)
                continue;
            const ct = String(res.headers.get('content-type') || '').toLowerCase();
            if (!ct.includes('image'))
                continue;
            const ab = await res.arrayBuffer();
            const buffer = Buffer.from(ab);
            if (buffer.length < 500)
                continue;
            const mimeType = ct.includes('png') ? 'image/png' : 'image/jpeg';
            return { buffer, mimeType };
        }
        catch {
            /* try next */
        }
    }
    return null;
}
class ProductPhotoImportService {
    static async importMissing(merchantId, opts) {
        const db = (0, db_1.getDb)();
        const cap = Math.min(Math.max(Number(opts?.limit) || 50, 1), 100);
        const ids = Array.isArray(opts?.productIds)
            ? [...new Set(opts.productIds.map(String).filter(Boolean))].slice(0, cap)
            : [];
        const where = [
            (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
            (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(db_1.schema.products.imageUrl), (0, drizzle_orm_1.eq)(db_1.schema.products.imageUrl, ''), (0, drizzle_orm_1.sql) `btrim(${db_1.schema.products.imageUrl}) = ''`),
        ];
        if (ids.length) {
            where.push((0, drizzle_orm_1.inArray)(db_1.schema.products.id, ids));
        }
        const missing = await db.query.products.findMany({
            where: (0, drizzle_orm_1.and)(...where),
            columns: { id: true, name: true, imageUrl: true },
            limit: cap,
        });
        const updated = [];
        let failed = 0;
        for (const product of missing) {
            const category = guessCategory(product.name);
            const img = await fetchFoodishImage(category);
            if (!img) {
                failed += 1;
                continue;
            }
            try {
                const saved = await (0, media_upload_service_1.saveMerchantImage)({
                    merchantId,
                    buffer: img.buffer,
                    mimeType: img.mimeType,
                    originalName: `${category}.jpg`,
                });
                await db
                    .update(db_1.schema.products)
                    .set({ imageUrl: saved.url, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, product.id), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)));
                updated.push({ id: product.id, imageUrl: saved.url });
            }
            catch {
                failed += 1;
            }
        }
        return {
            updated: updated.length,
            skipped: 0,
            failed,
            products: updated,
        };
    }
}
exports.ProductPhotoImportService = ProductPhotoImportService;
//# sourceMappingURL=product-photo-import.service.js.map