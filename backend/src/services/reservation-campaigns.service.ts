import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb, schema } from "@/db";
import { ensureReservationCampaignsAddonColumn } from "@/lib/ensure-merchant-schema";
import { merchantHasReservationCampaignsLicense } from "@/lib/reservation-campaigns-addon";

function normalizeCode(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export class ReservationCampaignsService {
  static async list(merchantId: string) {
    await ensureReservationCampaignsAddonColumn();
    const db = getDb();
    const rows = await db.query.reservationGrowthCampaigns.findMany({
      where: eq(schema.reservationGrowthCampaigns.merchantId, merchantId),
      orderBy: [desc(schema.reservationGrowthCampaigns.createdAt)],
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      perkLabel: r.perkLabel,
      message: r.message,
      clickCount: r.clickCount,
      bookingCount: r.bookingCount,
      active: r.active,
      createdAt: r.createdAt,
    }));
  }

  static async save(
    merchantId: string,
    input: {
      id?: string;
      code?: string;
      name: string;
      perkLabel?: string | null;
      message?: string | null;
      active?: boolean;
    }
  ) {
    if (!(await merchantHasReservationCampaignsLicense(merchantId))) {
      throw new Error("Reservation campaigns requires the Reservation Campaigns add-on");
    }
    await ensureReservationCampaignsAddonColumn();
    const db = getDb();
    const name = String(input.name || "").trim().slice(0, 200);
    if (!name) throw new Error("Campaign name is required");
    const code = normalizeCode(input.code || name) || `camp-${randomUUID().slice(0, 8)}`;
    const patch = {
      name,
      code,
      perkLabel: input.perkLabel?.trim().slice(0, 200) || null,
      message: input.message?.trim().slice(0, 2000) || null,
      active: input.active !== false,
      updatedAt: new Date(),
    };

    if (input.id) {
      const [row] = await db
        .update(schema.reservationGrowthCampaigns)
        .set(patch)
        .where(
          and(
            eq(schema.reservationGrowthCampaigns.id, input.id),
            eq(schema.reservationGrowthCampaigns.merchantId, merchantId)
          )
        )
        .returning();
      if (!row) throw new Error("Campaign not found");
      return row;
    }

    const [row] = await db
      .insert(schema.reservationGrowthCampaigns)
      .values({ merchantId, ...patch })
      .returning();
    return row;
  }

  static async trackClick(merchantId: string, code: string) {
    await ensureReservationCampaignsAddonColumn();
    const db = getDb();
    const normalized = normalizeCode(code);
    const [row] = await db
      .update(schema.reservationGrowthCampaigns)
      .set({
        clickCount: sql`${schema.reservationGrowthCampaigns.clickCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.reservationGrowthCampaigns.merchantId, merchantId),
          eq(schema.reservationGrowthCampaigns.code, normalized),
          eq(schema.reservationGrowthCampaigns.active, true)
        )
      )
      .returning();
    return row || null;
  }

  static async trackBooking(merchantId: string, code: string) {
    await ensureReservationCampaignsAddonColumn();
    const db = getDb();
    const normalized = normalizeCode(code);
    const [row] = await db
      .update(schema.reservationGrowthCampaigns)
      .set({
        bookingCount: sql`${schema.reservationGrowthCampaigns.bookingCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.reservationGrowthCampaigns.merchantId, merchantId),
          eq(schema.reservationGrowthCampaigns.code, normalized),
          eq(schema.reservationGrowthCampaigns.active, true)
        )
      )
      .returning();
    return row || null;
  }

  static async publicInfo(merchantId: string, code: string) {
    await ensureReservationCampaignsAddonColumn();
    const db = getDb();
    const normalized = normalizeCode(code);
    const row = await db.query.reservationGrowthCampaigns.findFirst({
      where: and(
        eq(schema.reservationGrowthCampaigns.merchantId, merchantId),
        eq(schema.reservationGrowthCampaigns.code, normalized),
        eq(schema.reservationGrowthCampaigns.active, true)
      ),
    });
    if (!row) return null;
    return {
      code: row.code,
      name: row.name,
      perkLabel: row.perkLabel,
      message: row.message,
    };
  }
}
