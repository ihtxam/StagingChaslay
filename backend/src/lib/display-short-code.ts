import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

type Db = ReturnType<typeof getDb>;

/** Allocate a numeric short code (5–6 digits), unique across TV/KDS/ODS displays. */
export async function allocateDisplayShortCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 80; attempt++) {
    const digits = attempt < 40 ? 5 : 6;
    const min = digits === 5 ? 10000 : 100000;
    const max = digits === 5 ? 99999 : 999999;
    const code = String(Math.floor(min + Math.random() * (max - min + 1)));
    if (!(await isDisplayShortCodeTaken(db, code))) return code;
  }
  throw new Error("Could not allocate a display code — try again");
}

async function isDisplayShortCodeTaken(db: Db, code: string): Promise<boolean> {
  const [kds, ods, signage] = await Promise.all([
    db.query.kdsStations.findFirst({
      where: eq(schema.kdsStations.shortCode, code),
      columns: { id: true },
    }),
    db.query.odsDisplays.findFirst({
      where: eq(schema.odsDisplays.shortCode, code),
      columns: { id: true },
    }),
    db.query.signageScreens.findFirst({
      where: eq(schema.signageScreens.shortCode, code),
      columns: { id: true },
    }),
  ]);
  return !!(kds || ods || signage);
}

export async function ensureKdsStationShortCodes(db: Db, merchantId: string) {
  const rows = await db.query.kdsStations.findMany({
    where: eq(schema.kdsStations.merchantId, merchantId),
    columns: { id: true, shortCode: true },
  });
  for (const row of rows) {
    if (row.shortCode) continue;
    const shortCode = await allocateDisplayShortCode(db);
    await db
      .update(schema.kdsStations)
      .set({ shortCode, updatedAt: new Date() })
      .where(eq(schema.kdsStations.id, row.id));
  }
}

export async function ensureOdsDisplayShortCodes(db: Db, merchantId: string) {
  const rows = await db.query.odsDisplays.findMany({
    where: eq(schema.odsDisplays.merchantId, merchantId),
    columns: { id: true, shortCode: true },
  });
  for (const row of rows) {
    if (row.shortCode) continue;
    const shortCode = await allocateDisplayShortCode(db);
    await db
      .update(schema.odsDisplays)
      .set({ shortCode, updatedAt: new Date() })
      .where(eq(schema.odsDisplays.id, row.id));
  }
}
