import { and, asc, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  ensurePosStationsSchema,
  withMerchantSchemaRetry,
} from "@/lib/ensure-merchant-schema";
import { LocationsService } from "@/services/locations.service";

export type PosStationSettings = {
  kitchenPrinterName?: string | null;
  receiptPrinterName?: string | null;
};

export type PosStationRow = {
  id: string;
  merchantId: string;
  locationId: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  status: string;
  settings: PosStationSettings;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(r: typeof schema.posStations.$inferSelect): PosStationRow {
  return {
    id: r.id,
    merchantId: r.merchantId,
    locationId: r.locationId,
    name: r.name,
    sortOrder: r.sortOrder ?? 0,
    isDefault: !!r.isDefault,
    status: r.status || "active",
    settings: (r.settings as PosStationSettings) || {},
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export class PosStationsService {
  static async listForLocation(merchantId: string, locationId: string): Promise<PosStationRow[]> {
    await ensurePosStationsSchema();
    const resolved = await LocationsService.resolveLocationIdOrNull(merchantId, locationId);
    if (!resolved) return [];
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const rows = await db.query.posStations.findMany({
        where: and(
          eq(schema.posStations.merchantId, merchantId),
          eq(schema.posStations.locationId, resolved),
          eq(schema.posStations.status, "active")
        ),
        orderBy: [asc(schema.posStations.sortOrder), asc(schema.posStations.name)],
      });
      return rows.map(mapRow);
    });
  }

  static async listAll(merchantId: string): Promise<PosStationRow[]> {
    await ensurePosStationsSchema();
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const rows = await db.query.posStations.findMany({
        where: and(eq(schema.posStations.merchantId, merchantId), eq(schema.posStations.status, "active")),
        orderBy: [asc(schema.posStations.locationId), asc(schema.posStations.sortOrder)],
      });
      return rows.map(mapRow);
    });
  }

  static async resolveStationId(
    merchantId: string,
    locationId: string | null | undefined,
    stationId?: string | null
  ): Promise<string | null> {
    const sid = String(stationId || "").trim();
    if (!sid) return null;
    await ensurePosStationsSchema();
    const loc = locationId
      ? await LocationsService.resolveLocationIdOrNull(merchantId, locationId)
      : null;
    const db = getDb();
    const row = await db.query.posStations.findFirst({
      where: and(
        eq(schema.posStations.id, sid),
        eq(schema.posStations.merchantId, merchantId),
        eq(schema.posStations.status, "active"),
        loc ? eq(schema.posStations.locationId, loc) : undefined
      ),
    });
    return row?.id ?? null;
  }

  static async create(
    merchantId: string,
    locationId: string,
    input: { name: string; sortOrder?: number; isDefault?: boolean; settings?: PosStationSettings }
  ): Promise<PosStationRow> {
    await ensurePosStationsSchema();
    const loc = await LocationsService.resolveLocationId(merchantId, locationId);
    const name = String(input.name || "").trim().slice(0, 120);
    if (!name) throw new Error("Station name is required");

    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0;
      const isDefault = !!input.isDefault;

      if (isDefault) {
        await db
          .update(schema.posStations)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(eq(schema.posStations.merchantId, merchantId), eq(schema.posStations.locationId, loc))
          );
      }

      const [row] = await db
        .insert(schema.posStations)
        .values({
          merchantId,
          locationId: loc,
          name,
          sortOrder,
          isDefault,
          status: "active",
          settings: input.settings || {},
        })
        .returning();
      return mapRow(row);
    });
  }

  static async update(
    merchantId: string,
    locationId: string,
    stationId: string,
    input: {
      name?: string;
      sortOrder?: number;
      isDefault?: boolean;
      settings?: PosStationSettings;
      status?: string;
    }
  ): Promise<PosStationRow> {
    await ensurePosStationsSchema();
    const loc = await LocationsService.resolveLocationId(merchantId, locationId);
    const id = await this.resolveStationId(merchantId, loc, stationId);
    if (!id) throw new Error("Station not found");

    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const patch: Partial<typeof schema.posStations.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name != null) {
        const name = String(input.name).trim().slice(0, 120);
        if (!name) throw new Error("Station name is required");
        patch.name = name;
      }
      if (input.sortOrder != null && Number.isFinite(Number(input.sortOrder))) {
        patch.sortOrder = Number(input.sortOrder);
      }
      if (input.settings != null) patch.settings = input.settings;
      if (input.status != null) patch.status = String(input.status).slice(0, 20);
      if (input.isDefault === true) {
        await db
          .update(schema.posStations)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(schema.posStations.merchantId, merchantId),
              eq(schema.posStations.locationId, loc),
              ne(schema.posStations.id, id)
            )
          );
        patch.isDefault = true;
      } else if (input.isDefault === false) {
        patch.isDefault = false;
      }

      const [row] = await db
        .update(schema.posStations)
        .set(patch)
        .where(and(eq(schema.posStations.id, id), eq(schema.posStations.merchantId, merchantId)))
        .returning();
      if (!row) throw new Error("Station not found");
      return mapRow(row);
    });
  }

  static async remove(merchantId: string, locationId: string, stationId: string): Promise<void> {
    await ensurePosStationsSchema();
    const loc = await LocationsService.resolveLocationId(merchantId, locationId);
    const id = await this.resolveStationId(merchantId, loc, stationId);
    if (!id) throw new Error("Station not found");

    await withMerchantSchemaRetry(async () => {
      const db = getDb();
      await db
        .update(schema.posStations)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(schema.posStations.id, id), eq(schema.posStations.merchantId, merchantId)));
    });
  }
}
