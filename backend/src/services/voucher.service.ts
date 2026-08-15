import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { roundMoney2 } from "@/lib/money";
import type { VoucherDiscountType, VoucherUsageType } from "@/db/schema";

export type VoucherInput = {
  code: string;
  name?: string | null;
  usageType?: VoucherUsageType;
  maxRedemptions?: number;
  customerId?: string | null;
  discountType?: VoucherDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  validFrom?: string | Date | null;
  validTo?: string | Date | null;
  isActive?: boolean;
};

export class VoucherService {
  static normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  static async list(merchantId: string) {
    const db = getDb();
    const rows = await db.query.vouchers.findMany({
      where: eq(schema.vouchers.merchantId, merchantId),
      orderBy: desc(schema.vouchers.createdAt),
      with: {
        customer: { columns: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    return rows.map((v) => this.serialize(v));
  }

  static async getById(merchantId: string, voucherId: string) {
    const db = getDb();
    const row = await db.query.vouchers.findFirst({
      where: and(eq(schema.vouchers.id, voucherId), eq(schema.vouchers.merchantId, merchantId)),
      with: {
        customer: { columns: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!row) throw new Error("Voucher not found");
    return this.serialize(row);
  }

  static async create(merchantId: string, input: VoucherInput) {
    const code = this.normalizeCode(input.code);
    if (!code) throw new Error("Voucher code is required");
    const discountValue = Number(input.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new Error("Discount value must be greater than 0");
    }
    const usageType = (input.usageType || "multi_use") as VoucherUsageType;
    const discountType = (input.discountType || "percent") as VoucherDiscountType;
    if (discountType === "percent" && discountValue > 100) {
      throw new Error("Percent discount cannot exceed 100");
    }
    const maxRedemptions =
      usageType === "single_use"
        ? 1
        : Math.max(1, Math.floor(Number(input.maxRedemptions) || 1));
    if (usageType === "customer" && !input.customerId) {
      throw new Error("Customer is required for account-based vouchers");
    }

    const db = getDb();
    const existing = await db.query.vouchers.findFirst({
      where: and(eq(schema.vouchers.merchantId, merchantId), eq(schema.vouchers.code, code)),
    });
    if (existing) throw new Error("This voucher code already exists");

    const [row] = await db
      .insert(schema.vouchers)
      .values({
        merchantId,
        code,
        name: input.name?.trim() || null,
        usageType,
        maxRedemptions,
        customerId: usageType === "customer" ? input.customerId || null : null,
        discountType,
        discountValue: String(discountValue),
        minOrderAmount: String(Math.max(0, Number(input.minOrderAmount) || 0)),
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validTo: input.validTo ? new Date(input.validTo) : null,
        isActive: input.isActive !== false,
      })
      .returning();
    return this.serialize(row);
  }

  static async update(merchantId: string, voucherId: string, input: Partial<VoucherInput>) {
    const db = getDb();
    const current = await db.query.vouchers.findFirst({
      where: and(eq(schema.vouchers.id, voucherId), eq(schema.vouchers.merchantId, merchantId)),
    });
    if (!current) throw new Error("Voucher not found");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.code !== undefined) {
      const code = this.normalizeCode(input.code);
      if (!code) throw new Error("Voucher code is required");
      if (code !== current.code) {
        const dup = await db.query.vouchers.findFirst({
          where: and(eq(schema.vouchers.merchantId, merchantId), eq(schema.vouchers.code, code)),
        });
        if (dup) throw new Error("This voucher code already exists");
      }
      patch.code = code;
    }
    if (input.name !== undefined) patch.name = input.name?.trim() || null;
    if (input.usageType !== undefined) patch.usageType = input.usageType;
    if (input.discountType !== undefined) patch.discountType = input.discountType;
    if (input.discountValue !== undefined) {
      const discountValue = Number(input.discountValue);
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error("Discount value must be greater than 0");
      }
      const discountType = (input.discountType || current.discountType) as VoucherDiscountType;
      if (discountType === "percent" && discountValue > 100) {
        throw new Error("Percent discount cannot exceed 100");
      }
      patch.discountValue = String(discountValue);
    }
    if (input.minOrderAmount !== undefined) {
      patch.minOrderAmount = String(Math.max(0, Number(input.minOrderAmount) || 0));
    }
    if (input.validFrom !== undefined) {
      patch.validFrom = input.validFrom ? new Date(input.validFrom) : null;
    }
    if (input.validTo !== undefined) {
      patch.validTo = input.validTo ? new Date(input.validTo) : null;
    }
    if (input.isActive !== undefined) patch.isActive = !!input.isActive;
    if (input.maxRedemptions !== undefined) {
      patch.maxRedemptions = Math.max(1, Math.floor(Number(input.maxRedemptions) || 1));
    }
    const usageType = (input.usageType || current.usageType) as VoucherUsageType;
    if (usageType === "single_use") patch.maxRedemptions = 1;
    if (input.customerId !== undefined || usageType === "customer") {
      const customerId = input.customerId ?? current.customerId;
      if (usageType === "customer" && !customerId) {
        throw new Error("Customer is required for account-based vouchers");
      }
      patch.customerId = usageType === "customer" ? customerId : null;
    }

    const [row] = await db
      .update(schema.vouchers)
      .set(patch)
      .where(and(eq(schema.vouchers.id, voucherId), eq(schema.vouchers.merchantId, merchantId)))
      .returning();
    return this.serialize(row);
  }

  static async remove(merchantId: string, voucherId: string) {
    const db = getDb();
    const deleted = await db
      .delete(schema.vouchers)
      .where(and(eq(schema.vouchers.id, voucherId), eq(schema.vouchers.merchantId, merchantId)))
      .returning({ id: schema.vouchers.id });
    if (!deleted.length) throw new Error("Voucher not found");
  }

  static async listRedemptions(merchantId: string, voucherId: string) {
    const db = getDb();
    const voucher = await db.query.vouchers.findFirst({
      where: and(eq(schema.vouchers.id, voucherId), eq(schema.vouchers.merchantId, merchantId)),
    });
    if (!voucher) throw new Error("Voucher not found");
    const rows = await db.query.voucherRedemptions.findMany({
      where: and(
        eq(schema.voucherRedemptions.merchantId, merchantId),
        eq(schema.voucherRedemptions.voucherId, voucherId)
      ),
      orderBy: desc(schema.voucherRedemptions.createdAt),
      with: {
        customer: { columns: { id: true, email: true, firstName: true, lastName: true } },
        order: { columns: { id: true, orderNumber: true, total: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      discountAmount: Number(r.discountAmount),
      createdAt: r.createdAt,
      customer: r.customer,
      order: r.order,
    }));
  }

  static computeDiscount(
    voucher: { discountType: string; discountValue: string | number },
    subtotal: number
  ): number {
    const base = Math.max(0, subtotal);
    const value = Number(voucher.discountValue);
    if (voucher.discountType === "fixed") {
      return roundMoney2(Math.min(base, value));
    }
    return roundMoney2((base * value) / 100);
  }

  static async validateForShop(
    merchantId: string,
    code: string,
    subtotal: number,
    customerId?: string
  ) {
    const normalized = this.normalizeCode(code);
    if (!normalized) throw new Error("Enter a voucher code");

    const db = getDb();
    const voucher = await db.query.vouchers.findFirst({
      where: and(eq(schema.vouchers.merchantId, merchantId), eq(schema.vouchers.code, normalized)),
    });
    if (!voucher) throw new Error("Invalid voucher code");
    if (!voucher.isActive) throw new Error("This voucher is no longer active");

    const now = new Date();
    if (voucher.validFrom && now < new Date(voucher.validFrom)) {
      throw new Error("This voucher is not valid yet");
    }
    if (voucher.validTo && now > new Date(voucher.validTo)) {
      throw new Error("This voucher has expired");
    }

    const minOrder = Number(voucher.minOrderAmount || 0);
    if (minOrder > 0 && subtotal < minOrder) {
      throw new Error(`Minimum order amount is CHF ${minOrder.toFixed(2)}`);
    }

    const usageType = voucher.usageType as VoucherUsageType;
    if (usageType === "customer") {
      if (!customerId) throw new Error("Login required to use this voucher");
      if (voucher.customerId && voucher.customerId !== customerId) {
        throw new Error("This voucher is not valid for your account");
      }
      const prior = await db.query.voucherRedemptions.findFirst({
        where: and(
          eq(schema.voucherRedemptions.voucherId, voucher.id),
          eq(schema.voucherRedemptions.customerId, customerId)
        ),
      });
      if (prior) throw new Error("You have already used this voucher");
    } else {
      const max = usageType === "single_use" ? 1 : Math.max(1, voucher.maxRedemptions || 1);
      if ((voucher.redemptionCount || 0) >= max) {
        throw new Error("This voucher has reached its redemption limit");
      }
    }

    const discount = this.computeDiscount(voucher, subtotal);
    if (discount <= 0) throw new Error("Voucher does not apply to this order");

    return {
      voucherId: voucher.id,
      code: voucher.code,
      name: voucher.name || voucher.code,
      discountType: voucher.discountType,
      discountValue: Number(voucher.discountValue),
      discount,
    };
  }

  static async redeem(
    merchantId: string,
    voucherId: string,
    opts: { orderId: string; customerId?: string | null; discountAmount: number; code: string }
  ) {
    const db = getDb();
    const voucher = await db.query.vouchers.findFirst({
      where: and(eq(schema.vouchers.id, voucherId), eq(schema.vouchers.merchantId, merchantId)),
    });
    if (!voucher) throw new Error("Voucher not found");

    await db.insert(schema.voucherRedemptions).values({
      merchantId,
      voucherId,
      orderId: opts.orderId,
      customerId: opts.customerId || null,
      code: opts.code,
      discountAmount: String(roundMoney2(opts.discountAmount)),
    });

    await db
      .update(schema.vouchers)
      .set({
        redemptionCount: sql`${schema.vouchers.redemptionCount} + 1`,
        updatedAt: new Date(),
        ...(voucher.usageType === "single_use" ? { isActive: false } : {}),
      })
      .where(eq(schema.vouchers.id, voucherId));
  }

  private static serialize(v: typeof schema.vouchers.$inferSelect & {
    customer?: {
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
    } | null;
  }) {
    return {
      id: v.id,
      code: v.code,
      name: v.name,
      usageType: v.usageType,
      maxRedemptions: v.maxRedemptions,
      customerId: v.customerId,
      customer: v.customer
        ? {
            id: v.customer.id,
            email: v.customer.email,
            name: [v.customer.firstName, v.customer.lastName].filter(Boolean).join(" ").trim(),
          }
        : null,
      discountType: v.discountType,
      discountValue: Number(v.discountValue),
      minOrderAmount: Number(v.minOrderAmount || 0),
      validFrom: v.validFrom,
      validTo: v.validTo,
      isActive: v.isActive,
      redemptionCount: v.redemptionCount,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }
}
