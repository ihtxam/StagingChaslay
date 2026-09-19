import crypto from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AuthService } from "@/services/auth.service";
import { EmailService } from "@/services/email.service";
import { ShopLoyaltyService } from "@/services/shop-loyalty.service";

export type SavedAddressInput = {
  label?: string;
  address: string;
  zipCode?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
};

function normalizeLabel(raw: string | undefined | null): string {
  const v = String(raw || "home").trim().toLowerCase().slice(0, 40);
  if (v === "home" || v === "office" || v === "other") return v;
  return v || "home";
}

function publicAddress(row: typeof schema.customerAddresses.$inferSelect) {
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    zipCode: row.zipCode,
    city: row.city,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    isDefault: !!row.isDefault,
  };
}

function normalizeAddressKey(input: {
  address?: string | null;
  zipCode?: string | null;
  city?: string | null;
}): string {
  return [input.address || "", input.zipCode || "", input.city || ""]
    .map((s) => String(s).trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function splitCheckoutName(name?: string | null): { firstName?: string; lastName?: string } {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return {};
  return {
    firstName: parts[0].slice(0, 100),
    lastName: parts.slice(1).join(" ").slice(0, 100) || undefined,
  };
}

export class ShopCustomerService {
  static async register(
    merchantId: string,
    input: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ) {
    const db = getDb();
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password || input.password.length < 6) {
      throw new Error("Valid email and password (min 6 chars) are required");
    }

    const existing = await db.query.customers.findFirst({
      where: and(eq(schema.customers.merchantId, merchantId), eq(schema.customers.email, email)),
    });

    if (existing?.passwordHash) {
      throw new Error("An account with this email already exists — please log in");
    }

    const passwordHash = await AuthService.hashPassword(input.password);

    if (existing) {
      const [updated] = await db
        .update(schema.customers)
        .set({
          passwordHash,
          firstName: input.firstName || existing.firstName,
          lastName: input.lastName || existing.lastName,
          phone: input.phone || existing.phone,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, existing.id))
        .returning();
      return this.tokenFor(updated);
    }

    const [created] = await db
      .insert(schema.customers)
      .values({
        merchantId,
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      })
      .returning();

    return this.tokenFor(created);
  }

  static async requestPasswordReset(merchantId: string, email: string) {
    const db = getDb();
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      throw new Error("Valid email is required");
    }

    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.merchantId, merchantId), eq(schema.customers.email, normalized)),
    });

    if (!customer?.passwordHash) {
      return { success: true };
    }

    const tempPassword = crypto.randomBytes(4).toString("hex");
    const passwordHash = await AuthService.hashPassword(tempPassword);
    await db
      .update(schema.customers)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.customers.id, customer.id));

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { id: true, name: true, shopLanguage: true, panelLanguage: true },
    });
    const shopName = String(merchant?.name || "Shop");
    const locale = merchant?.shopLanguage || merchant?.panelLanguage || "en";
    const subject =
      locale === "fr"
        ? `${shopName} — mot de passe temporaire`
        : locale === "de"
          ? `${shopName} — temporäres Passwort`
          : `${shopName} — temporary password`;
    const body =
      locale === "fr"
        ? `Voici votre mot de passe temporaire : ${tempPassword}\nConnectez-vous puis changez-le dans Mon compte.`
        : locale === "de"
          ? `Ihr temporäres Passwort: ${tempPassword}\nMelden Sie sich an und ändern Sie es unter Mein Konto.`
          : `Your temporary password: ${tempPassword}\nSign in and change it under My account.`;

    try {
      await EmailService.send({
        to: normalized,
        subject,
        html: `<p style="font-family:system-ui,sans-serif">${body.replace(/\n/g, "<br/>")}</p>`,
        text: body,
        merchantId,
        emailType: "shop_customer",
      });
    } catch (err) {
      console.error("[shop-customer] password reset email failed", err);
    }

    return { success: true };
  }

  static async login(merchantId: string, email: string, password: string) {
    const db = getDb();
    const normalized = email.trim().toLowerCase();
    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.merchantId, merchantId), eq(schema.customers.email, normalized)),
    });
    if (!customer?.passwordHash) {
      throw new Error("Invalid email or password");
    }
    const ok = await AuthService.comparePassword(password, customer.passwordHash);
    if (!ok) throw new Error("Invalid email or password");
    return this.tokenFor(customer);
  }

  static async getProfile(customerId: string, merchantId: string) {
    const db = getDb();
    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)),
    });
    if (!customer) throw new Error("Customer not found");
    let loyaltyPoints = customer.loyaltyPoints ?? 0;
    try {
      loyaltyPoints = await ShopLoyaltyService.getBalance(merchantId, customerId);
    } catch {
      /* keep cached */
    }
    const addresses = await this.listAddresses(customerId, merchantId);
    return this.publicCustomer({ ...customer, loyaltyPoints }, addresses);
  }

  static async updateProfile(
    customerId: string,
    merchantId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      defaultAddress?: string;
      defaultZip?: string;
      defaultCity?: string;
    }
  ) {
    const db = getDb();
    const [updated] = await db
      .update(schema.customers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)))
      .returning();
    if (!updated) throw new Error("Customer not found");
    const addresses = await this.listAddresses(customerId, merchantId);
    return this.publicCustomer(updated, addresses);
  }

  /** Ensure legacy default_* fields become a saved Home address once. */
  static async ensureMigratedDefaultAddress(customerId: string, merchantId: string) {
    const db = getDb();
    const existing = await db.query.customerAddresses.findMany({
      where: and(
        eq(schema.customerAddresses.customerId, customerId),
        eq(schema.customerAddresses.merchantId, merchantId)
      ),
      limit: 1,
    });
    if (existing.length) return;

    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)),
    });
    if (!customer?.defaultAddress?.trim()) return;

    await db.insert(schema.customerAddresses).values({
      customerId,
      merchantId,
      label: "home",
      address: customer.defaultAddress.trim(),
      zipCode: customer.defaultZip || null,
      city: customer.defaultCity || null,
      isDefault: true,
    });
  }

  static async listAddresses(customerId: string, merchantId: string) {
    await this.ensureMigratedDefaultAddress(customerId, merchantId);
    const db = getDb();
    const rows = await db.query.customerAddresses.findMany({
      where: and(
        eq(schema.customerAddresses.customerId, customerId),
        eq(schema.customerAddresses.merchantId, merchantId)
      ),
      orderBy: [
        desc(schema.customerAddresses.isDefault),
        asc(schema.customerAddresses.createdAt),
      ],
    });
    return rows.map(publicAddress);
  }

  static async createAddress(customerId: string, merchantId: string, input: SavedAddressInput) {
    const address = String(input.address || "").trim();
    if (!address) throw new Error("Address is required");
    const db = getDb();
    const existing = await this.listAddresses(customerId, merchantId);
    const makeDefault = input.isDefault === true || existing.length === 0;
    if (makeDefault) {
      await db
        .update(schema.customerAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(schema.customerAddresses.customerId, customerId),
            eq(schema.customerAddresses.merchantId, merchantId)
          )
        );
    }
    const [row] = await db
      .insert(schema.customerAddresses)
      .values({
        customerId,
        merchantId,
        label: normalizeLabel(input.label),
        address,
        zipCode: input.zipCode?.trim() || null,
        city: input.city?.trim() || null,
        latitude:
          input.latitude != null && Number.isFinite(Number(input.latitude))
            ? String(input.latitude)
            : null,
        longitude:
          input.longitude != null && Number.isFinite(Number(input.longitude))
            ? String(input.longitude)
            : null,
        isDefault: makeDefault,
      })
      .returning();

    // Keep legacy default_* in sync with default address
    if (makeDefault) {
      await db
        .update(schema.customers)
        .set({
          defaultAddress: row.address,
          defaultZip: row.zipCode,
          defaultCity: row.city,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, customerId));
    }

    return publicAddress(row);
  }

  static async updateAddress(
    customerId: string,
    merchantId: string,
    addressId: string,
    input: Partial<SavedAddressInput>
  ) {
    const db = getDb();
    const current = await db.query.customerAddresses.findFirst({
      where: and(
        eq(schema.customerAddresses.id, addressId),
        eq(schema.customerAddresses.customerId, customerId),
        eq(schema.customerAddresses.merchantId, merchantId)
      ),
    });
    if (!current) throw new Error("Address not found");

    if (input.isDefault === true) {
      await db
        .update(schema.customerAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(schema.customerAddresses.customerId, customerId),
            eq(schema.customerAddresses.merchantId, merchantId)
          )
        );
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.label !== undefined) patch.label = normalizeLabel(input.label);
    if (input.address !== undefined) {
      const address = String(input.address).trim();
      if (!address) throw new Error("Address is required");
      patch.address = address;
    }
    if (input.zipCode !== undefined) patch.zipCode = input.zipCode?.trim() || null;
    if (input.city !== undefined) patch.city = input.city?.trim() || null;
    if (input.latitude !== undefined) {
      patch.latitude =
        input.latitude != null && Number.isFinite(Number(input.latitude))
          ? String(input.latitude)
          : null;
    }
    if (input.longitude !== undefined) {
      patch.longitude =
        input.longitude != null && Number.isFinite(Number(input.longitude))
          ? String(input.longitude)
          : null;
    }
    if (input.isDefault !== undefined) patch.isDefault = !!input.isDefault;

    const [row] = await db
      .update(schema.customerAddresses)
      .set(patch)
      .where(eq(schema.customerAddresses.id, addressId))
      .returning();

    if (row.isDefault) {
      await db
        .update(schema.customers)
        .set({
          defaultAddress: row.address,
          defaultZip: row.zipCode,
          defaultCity: row.city,
          updatedAt: new Date(),
        })
        .where(eq(schema.customers.id, customerId));
    }

    return publicAddress(row);
  }

  static async deleteAddress(customerId: string, merchantId: string, addressId: string) {
    const db = getDb();
    const rows = await db
      .delete(schema.customerAddresses)
      .where(
        and(
          eq(schema.customerAddresses.id, addressId),
          eq(schema.customerAddresses.customerId, customerId),
          eq(schema.customerAddresses.merchantId, merchantId)
        )
      )
      .returning();
    if (!rows.length) throw new Error("Address not found");

    if (rows[0].isDefault) {
      const next = await db.query.customerAddresses.findFirst({
        where: and(
          eq(schema.customerAddresses.customerId, customerId),
          eq(schema.customerAddresses.merchantId, merchantId)
        ),
        orderBy: [asc(schema.customerAddresses.createdAt)],
      });
      if (next) {
        await db
          .update(schema.customerAddresses)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(schema.customerAddresses.id, next.id));
        await db
          .update(schema.customers)
          .set({
            defaultAddress: next.address,
            defaultZip: next.zipCode,
            defaultCity: next.city,
            updatedAt: new Date(),
          })
          .where(eq(schema.customers.id, customerId));
      }
    }

    return { success: true };
  }

  /** Fill blank profile fields from a logged-in checkout without overwriting set values. */
  static async syncFromCheckout(
    customerId: string,
    merchantId: string,
    input: {
      name?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      email?: string | null;
    }
  ) {
    const db = getDb();
    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, customerId), eq(schema.customers.merchantId, merchantId)),
    });
    if (!customer) return null;

    const split = splitCheckoutName(input.name);
    const first = String(input.firstName || split.firstName || "").trim().slice(0, 100);
    const last = String(input.lastName || split.lastName || "").trim().slice(0, 100);
    const phone = String(input.phone || "").trim().slice(0, 20);
    const email = String(input.email || "").trim().toLowerCase();

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (first && !customer.firstName) patch.firstName = first;
    if (last && !customer.lastName) patch.lastName = last;
    if (phone && !customer.phone) patch.phone = phone;
    if (email.includes("@") && !customer.email) patch.email = email;
    if (Object.keys(patch).length <= 1) return customer;

    const [updated] = await db
      .update(schema.customers)
      .set(patch)
      .where(eq(schema.customers.id, customerId))
      .returning();
    return updated || customer;
  }

  /**
   * Persist a delivery address on the shop account if it is new.
   * Guest checkout must not call this.
   */
  static async rememberCheckoutAddress(
    customerId: string,
    merchantId: string,
    input: SavedAddressInput
  ) {
    const address = String(input.address || "").trim();
    if (!address) return null;
    const existing = await this.listAddresses(customerId, merchantId);
    const nextKey = normalizeAddressKey({
      address,
      zipCode: input.zipCode,
      city: input.city,
    });
    const dup = existing.find(
      (row) =>
        normalizeAddressKey({
          address: row.address,
          zipCode: row.zipCode,
          city: row.city,
        }) === nextKey
    );
    if (dup) return dup;
    return this.createAddress(customerId, merchantId, {
      ...input,
      address,
      label: input.label || (existing.length ? "other" : "home"),
      isDefault: input.isDefault === true || existing.length === 0,
    });
  }

  private static publicCustomer(
    c: typeof schema.customers.$inferSelect,
    addresses: ReturnType<typeof publicAddress>[] = []
  ) {
    const def = addresses.find((a) => a.isDefault) || addresses[0];
    return {
      id: c.id,
      email: c.email,
      phone: c.phone,
      firstName: c.firstName,
      lastName: c.lastName,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email,
      defaultAddress: def?.address || c.defaultAddress,
      defaultZip: def?.zipCode || c.defaultZip,
      defaultCity: def?.city || c.defaultCity,
      addresses,
      hasAccount: !!c.passwordHash,
      loyaltyPoints: c.loyaltyPoints ?? 0,
    };
  }

  private static async tokenFor(customer: typeof schema.customers.$inferSelect) {
    const name =
      [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email || "";
    const token = AuthService.generateToken({
      id: customer.id,
      email: customer.email || "",
      role: "customer",
      merchantId: customer.merchantId,
      customerId: customer.id,
      name,
    });
    let addresses: ReturnType<typeof publicAddress>[] = [];
    try {
      addresses = await this.listAddresses(customer.id, customer.merchantId);
    } catch {
      /* table may not exist yet during first boot */
    }
    return { token, customer: this.publicCustomer(customer, addresses) };
  }
}
