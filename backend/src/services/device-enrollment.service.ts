import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normalizePosPrintSettings } from "@/lib/pos-print-settings";
import { PaymentProfilesService } from "@/services/payment-profiles.service";
import { terminalBelongsToProfile } from "@/lib/adyen-terminal-credentials";

export type DeviceEnrollmentPublic = {
  id: string;
  deviceId: string;
  merchantId: string;
  locationId: string;
  stationId: string | null;
  paymentProfileId: string;
  paymentTerminalId: string;
  terminalId: string;
  terminalName: string;
  printSnapshot: Record<string, unknown>;
  lockEnrollment: boolean;
  enrolledAt: Date;
};

export class DeviceEnrollmentService {
  static async getByDevice(merchantId: string, deviceId: string) {
    const id = String(deviceId || "").trim();
    if (!id) return null;
    const db = getDb();
    const row = await db.query.deviceEnrollments.findFirst({
      where: and(
        eq(schema.deviceEnrollments.merchantId, merchantId),
        eq(schema.deviceEnrollments.deviceId, id)
      ),
    });
    if (!row) return null;
    const terminal = await db.query.paymentTerminals.findFirst({
      where: eq(schema.paymentTerminals.id, row.paymentTerminalId),
    });
    return this.toPublic(row, terminal);
  }

  private static toPublic(
    row: typeof schema.deviceEnrollments.$inferSelect,
    terminal?: typeof schema.paymentTerminals.$inferSelect | null
  ): DeviceEnrollmentPublic {
    return {
      id: row.id,
      deviceId: row.deviceId,
      merchantId: row.merchantId,
      locationId: row.locationId,
      stationId: row.stationId,
      paymentProfileId: row.paymentProfileId,
      paymentTerminalId: row.paymentTerminalId,
      terminalId: terminal?.terminalId || "",
      terminalName: terminal?.terminalName || "",
      printSnapshot: (row.printSnapshot as Record<string, unknown>) || {},
      lockEnrollment: row.lockEnrollment,
      enrolledAt: row.enrolledAt,
    };
  }

  static async list(merchantId: string) {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.deviceEnrollments)
      .where(eq(schema.deviceEnrollments.merchantId, merchantId))
      .orderBy(desc(schema.deviceEnrollments.enrolledAt));
    const out: DeviceEnrollmentPublic[] = [];
    for (const row of rows) {
      const terminal = await db.query.paymentTerminals.findFirst({
        where: eq(schema.paymentTerminals.id, row.paymentTerminalId),
      });
      out.push(this.toPublic(row, terminal));
    }
    return out;
  }

  static async enroll(
    merchantId: string,
    enrolledByStaffId: string | null,
    input: {
      deviceId: string;
      locationId: string;
      stationId?: string | null;
      paymentProfileId: string;
      paymentTerminalId: string;
      printSnapshot?: Record<string, unknown>;
      lockEnrollment?: boolean;
    }
  ) {
    const deviceId = String(input.deviceId || "").trim();
    if (!deviceId) throw new Error("deviceId is required");
    const db = getDb();

    const profile = await db.query.paymentProfiles.findFirst({
      where: and(
        eq(schema.paymentProfiles.id, input.paymentProfileId),
        eq(schema.paymentProfiles.merchantId, merchantId)
      ),
    });
    if (!profile) throw new Error("Payment profile not found");
    if (profile.locationId && profile.locationId !== input.locationId) {
      throw new Error("Payment settings do not match this branch");
    }

    const terminal = await db.query.paymentTerminals.findFirst({
      where: and(
        eq(schema.paymentTerminals.id, input.paymentTerminalId),
        eq(schema.paymentTerminals.merchantId, merchantId)
      ),
    });
    if (!terminal) throw new Error("Payment terminal not found");

    const defaultProfileId = await PaymentProfilesService.getDefaultProfileId(merchantId);
    if (
      !terminalBelongsToProfile(
        terminal.paymentProfileId,
        profile.id,
        defaultProfileId
      )
    ) {
      throw new Error("Terminal does not belong to this payment profile");
    }

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    const printSnapshot = normalizePosPrintSettings({
      ...(merchant?.posPrintSettings && typeof merchant.posPrintSettings === "object"
        ? merchant.posPrintSettings
        : {}),
      ...(input.printSnapshot || {}),
    });

    const [row] = await db
      .insert(schema.deviceEnrollments)
      .values({
        merchantId,
        deviceId,
        locationId: input.locationId,
        stationId: input.stationId || null,
        paymentProfileId: profile.id,
        paymentTerminalId: terminal.id,
        printSnapshot,
        enrolledByStaffId,
        lockEnrollment: input.lockEnrollment !== false,
      })
      .onConflictDoUpdate({
        target: [schema.deviceEnrollments.merchantId, schema.deviceEnrollments.deviceId],
        set: {
          locationId: input.locationId,
          stationId: input.stationId || null,
          paymentProfileId: profile.id,
          paymentTerminalId: terminal.id,
          printSnapshot,
          enrolledByStaffId,
          enrolledAt: new Date(),
          lockEnrollment: input.lockEnrollment !== false,
        },
      })
      .returning();
    if (!row) throw new Error("Failed to enroll device");
    return this.toPublic(row, terminal);
  }

  static async remove(merchantId: string, deviceId: string) {
    const id = String(deviceId || "").trim();
    if (!id) throw new Error("deviceId is required");
    const db = getDb();
    await db
      .delete(schema.deviceEnrollments)
      .where(
        and(eq(schema.deviceEnrollments.merchantId, merchantId), eq(schema.deviceEnrollments.deviceId, id))
      );
  }

  static async resolveProfileScopeForDevice(
    merchantId: string,
    deviceId?: string | null
  ): Promise<string | null> {
    const id = String(deviceId || "").trim();
    if (!id) return null;
    const enrollment = await this.getByDevice(merchantId, id);
    return enrollment?.paymentProfileId || null;
  }

  static async getDeviceConfig(merchantId: string, deviceId: string) {
    const enrollment = await this.getByDevice(merchantId, deviceId);
    const defaultProfileId = await PaymentProfilesService.getDefaultProfileId(merchantId);
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    let terminals = await PaymentProfilesService.listTerminals(merchantId);
    if (enrollment) {
      terminals = terminals.filter((t) => t.id === enrollment.paymentTerminalId);
    }

    const posPrintSettings = enrollment?.printSnapshot
      ? normalizePosPrintSettings(enrollment.printSnapshot)
      : normalizePosPrintSettings(merchant.posPrintSettings);

    return {
      enrolled: !!enrollment,
      lockEnrollment: enrollment?.lockEnrollment ?? false,
      enrollment,
      paymentProfileId: enrollment?.paymentProfileId || defaultProfileId,
      defaultProfileId,
      terminals,
      posPrintSettings,
      fixedTerminalId: enrollment?.terminalId || null,
    };
  }
}
