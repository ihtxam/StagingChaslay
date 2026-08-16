import { and, asc, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getDb, schema } from "@/db";

export type TableQrCodeType = "static" | "temporary";

export type TableQrCodeRow = {
  id: string;
  tableId: string;
  codeType: TableQrCodeType;
  code: string;
  expiresAt: Date | null;
  createdAt: Date;
};

function isActiveTemporary(row: { codeType: string; expiresAt: Date | null }) {
  if (row.codeType !== "temporary") return true;
  if (!row.expiresAt) return true;
  return row.expiresAt.getTime() > Date.now();
}

export class TableQrService {
  static async listForMerchant(merchantId: string): Promise<TableQrCodeRow[]> {
    const db = getDb();
    const rows = await db.query.tableQrCodes.findMany({
      where: eq(schema.tableQrCodes.merchantId, merchantId),
      orderBy: [asc(schema.tableQrCodes.createdAt)],
    });
    return rows.filter(isActiveTemporary).map((r) => ({
      id: r.id,
      tableId: r.tableId,
      codeType: (r.codeType === "temporary" ? "temporary" : "static") as TableQrCodeType,
      code: r.code,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  }

  static async listForTable(merchantId: string, tableId: string): Promise<TableQrCodeRow[]> {
    const db = getDb();
    const table = await db.query.diningTables.findFirst({
      where: and(eq(schema.diningTables.id, tableId), eq(schema.diningTables.merchantId, merchantId)),
    });
    if (!table) throw new Error("Table not found");

    const rows = await db.query.tableQrCodes.findMany({
      where: and(
        eq(schema.tableQrCodes.merchantId, merchantId),
        eq(schema.tableQrCodes.tableId, tableId)
      ),
      orderBy: [asc(schema.tableQrCodes.createdAt)],
    });
    return rows.filter(isActiveTemporary).map((r) => ({
      id: r.id,
      tableId: r.tableId,
      codeType: (r.codeType === "temporary" ? "temporary" : "static") as TableQrCodeType,
      code: r.code,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    }));
  }

  /** Prefer static override; fall back to first active temporary. */
  static async resolvePayload(
    merchantId: string,
    tableId: string,
    defaultPayload: string
  ): Promise<string> {
    const codes = await this.listForTable(merchantId, tableId);
    const staticCode = codes.find((c) => c.codeType === "static");
    if (staticCode) return staticCode.code;
    const temp = codes.find((c) => c.codeType === "temporary");
    if (temp) return temp.code;
    return defaultPayload;
  }

  static async upsertStatic(merchantId: string, tableId: string, code: string) {
    const payload = String(code || "").trim();
    if (!payload) throw new Error("QR code is required");

    const db = getDb();
    const table = await db.query.diningTables.findFirst({
      where: and(eq(schema.diningTables.id, tableId), eq(schema.diningTables.merchantId, merchantId)),
    });
    if (!table) throw new Error("Table not found");

    const existing = await db.query.tableQrCodes.findFirst({
      where: and(
        eq(schema.tableQrCodes.merchantId, merchantId),
        eq(schema.tableQrCodes.tableId, tableId),
        eq(schema.tableQrCodes.codeType, "static")
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(schema.tableQrCodes)
        .set({ code: payload })
        .where(eq(schema.tableQrCodes.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await db
      .insert(schema.tableQrCodes)
      .values({
        merchantId,
        tableId,
        codeType: "static",
        code: payload,
      })
      .returning();
    return created!;
  }

  static async createTemporary(
    merchantId: string,
    tableId: string,
    code: string,
    expiresInHours = 24
  ) {
    const payload = String(code || "").trim();
    if (!payload) throw new Error("QR code is required");

    const db = getDb();
    const table = await db.query.diningTables.findFirst({
      where: and(eq(schema.diningTables.id, tableId), eq(schema.diningTables.merchantId, merchantId)),
    });
    if (!table) throw new Error("Table not found");

    const hours = Math.max(1, Math.min(168, Number(expiresInHours) || 24));
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const [created] = await db
      .insert(schema.tableQrCodes)
      .values({
        merchantId,
        tableId,
        codeType: "temporary",
        code: payload,
        expiresAt,
      })
      .returning();
    return created!;
  }

  static generateTemporaryToken(): string {
    return randomBytes(16).toString("hex");
  }

  static async deleteCode(merchantId: string, codeId: string) {
    const db = getDb();
    const row = await db.query.tableQrCodes.findFirst({
      where: and(eq(schema.tableQrCodes.id, codeId), eq(schema.tableQrCodes.merchantId, merchantId)),
    });
    if (!row) throw new Error("QR code not found");
    await db.delete(schema.tableQrCodes).where(eq(schema.tableQrCodes.id, codeId));
    return { success: true };
  }
}
