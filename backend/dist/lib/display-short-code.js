"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateDisplayShortCode = allocateDisplayShortCode;
exports.ensureKdsStationShortCodes = ensureKdsStationShortCodes;
exports.ensureOdsDisplayShortCodes = ensureOdsDisplayShortCodes;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
/** Allocate a numeric short code (5–6 digits), unique across TV/KDS/ODS displays. */
async function allocateDisplayShortCode(db) {
    for (let attempt = 0; attempt < 80; attempt++) {
        const digits = attempt < 40 ? 5 : 6;
        const min = digits === 5 ? 10000 : 100000;
        const max = digits === 5 ? 99999 : 999999;
        const code = String(Math.floor(min + Math.random() * (max - min + 1)));
        if (!(await isDisplayShortCodeTaken(db, code)))
            return code;
    }
    throw new Error("Could not allocate a display code — try again");
}
async function isDisplayShortCodeTaken(db, code) {
    const [kds, ods, signage] = await Promise.all([
        db.query.kdsStations.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.shortCode, code),
            columns: { id: true },
        }),
        db.query.odsDisplays.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.shortCode, code),
            columns: { id: true },
        }),
        db.query.signageScreens.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.signageScreens.shortCode, code),
            columns: { id: true },
        }),
    ]);
    return !!(kds || ods || signage);
}
async function ensureKdsStationShortCodes(db, merchantId) {
    const rows = await db.query.kdsStations.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.merchantId, merchantId),
        columns: { id: true, shortCode: true },
    });
    for (const row of rows) {
        if (row.shortCode)
            continue;
        const shortCode = await allocateDisplayShortCode(db);
        await db
            .update(db_1.schema.kdsStations)
            .set({ shortCode, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsStations.id, row.id));
    }
}
async function ensureOdsDisplayShortCodes(db, merchantId) {
    const rows = await db.query.odsDisplays.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.merchantId, merchantId),
        columns: { id: true, shortCode: true },
    });
    for (const row of rows) {
        if (row.shortCode)
            continue;
        const shortCode = await allocateDisplayShortCode(db);
        await db
            .update(db_1.schema.odsDisplays)
            .set({ shortCode, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.id, row.id));
    }
}
//# sourceMappingURL=display-short-code.js.map