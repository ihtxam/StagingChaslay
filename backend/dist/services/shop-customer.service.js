"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopCustomerService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const auth_service_1 = require("@/services/auth.service");
const shop_loyalty_service_1 = require("@/services/shop-loyalty.service");
function normalizeLabel(raw) {
    const v = String(raw || "home").trim().toLowerCase().slice(0, 40);
    if (v === "home" || v === "office" || v === "other")
        return v;
    return v || "home";
}
function publicAddress(row) {
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
class ShopCustomerService {
    static async register(merchantId, input) {
        const db = (0, db_1.getDb)();
        const email = input.email.trim().toLowerCase();
        if (!email || !input.password || input.password.length < 6) {
            throw new Error("Valid email and password (min 6 chars) are required");
        }
        const existing = await db.query.customers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.customers.email, email)),
        });
        if (existing?.passwordHash) {
            throw new Error("An account with this email already exists — please log in");
        }
        const passwordHash = await auth_service_1.AuthService.hashPassword(input.password);
        if (existing) {
            const [updated] = await db
                .update(db_1.schema.customers)
                .set({
                passwordHash,
                firstName: input.firstName || existing.firstName,
                lastName: input.lastName || existing.lastName,
                phone: input.phone || existing.phone,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, existing.id))
                .returning();
            return this.tokenFor(updated);
        }
        const [created] = await db
            .insert(db_1.schema.customers)
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
    static async login(merchantId, email, password) {
        const db = (0, db_1.getDb)();
        const normalized = email.trim().toLowerCase();
        const customer = await db.query.customers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.customers.email, normalized)),
        });
        if (!customer?.passwordHash) {
            throw new Error("Invalid email or password");
        }
        const ok = await auth_service_1.AuthService.comparePassword(password, customer.passwordHash);
        if (!ok)
            throw new Error("Invalid email or password");
        return this.tokenFor(customer);
    }
    static async getProfile(customerId, merchantId) {
        const db = (0, db_1.getDb)();
        const customer = await db.query.customers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)),
        });
        if (!customer)
            throw new Error("Customer not found");
        let loyaltyPoints = customer.loyaltyPoints ?? 0;
        try {
            loyaltyPoints = await shop_loyalty_service_1.ShopLoyaltyService.getBalance(merchantId, customerId);
        }
        catch {
            /* keep cached */
        }
        const addresses = await this.listAddresses(customerId, merchantId);
        return this.publicCustomer({ ...customer, loyaltyPoints }, addresses);
    }
    static async updateProfile(customerId, merchantId, updates) {
        const db = (0, db_1.getDb)();
        const [updated] = await db
            .update(db_1.schema.customers)
            .set({ ...updates, updatedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)))
            .returning();
        if (!updated)
            throw new Error("Customer not found");
        const addresses = await this.listAddresses(customerId, merchantId);
        return this.publicCustomer(updated, addresses);
    }
    /** Ensure legacy default_* fields become a saved Home address once. */
    static async ensureMigratedDefaultAddress(customerId, merchantId) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.customerAddresses.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.merchantId, merchantId)),
            limit: 1,
        });
        if (existing.length)
            return;
        const customer = await db.query.customers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)),
        });
        if (!customer?.defaultAddress?.trim())
            return;
        await db.insert(db_1.schema.customerAddresses).values({
            customerId,
            merchantId,
            label: "home",
            address: customer.defaultAddress.trim(),
            zipCode: customer.defaultZip || null,
            city: customer.defaultCity || null,
            isDefault: true,
        });
    }
    static async listAddresses(customerId, merchantId) {
        await this.ensureMigratedDefaultAddress(customerId, merchantId);
        const db = (0, db_1.getDb)();
        const rows = await db.query.customerAddresses.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.merchantId, merchantId)),
            orderBy: [
                (0, drizzle_orm_1.desc)(db_1.schema.customerAddresses.isDefault),
                (0, drizzle_orm_1.asc)(db_1.schema.customerAddresses.createdAt),
            ],
        });
        return rows.map(publicAddress);
    }
    static async createAddress(customerId, merchantId, input) {
        const address = String(input.address || "").trim();
        if (!address)
            throw new Error("Address is required");
        const db = (0, db_1.getDb)();
        const existing = await this.listAddresses(customerId, merchantId);
        const makeDefault = input.isDefault === true || existing.length === 0;
        if (makeDefault) {
            await db
                .update(db_1.schema.customerAddresses)
                .set({ isDefault: false, updatedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.merchantId, merchantId)));
        }
        const [row] = await db
            .insert(db_1.schema.customerAddresses)
            .values({
            customerId,
            merchantId,
            label: normalizeLabel(input.label),
            address,
            zipCode: input.zipCode?.trim() || null,
            city: input.city?.trim() || null,
            latitude: input.latitude != null && Number.isFinite(Number(input.latitude))
                ? String(input.latitude)
                : null,
            longitude: input.longitude != null && Number.isFinite(Number(input.longitude))
                ? String(input.longitude)
                : null,
            isDefault: makeDefault,
        })
            .returning();
        // Keep legacy default_* in sync with default address
        if (makeDefault) {
            await db
                .update(db_1.schema.customers)
                .set({
                defaultAddress: row.address,
                defaultZip: row.zipCode,
                defaultCity: row.city,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId));
        }
        return publicAddress(row);
    }
    static async updateAddress(customerId, merchantId, addressId, input) {
        const db = (0, db_1.getDb)();
        const current = await db.query.customerAddresses.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.id, addressId), (0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.merchantId, merchantId)),
        });
        if (!current)
            throw new Error("Address not found");
        if (input.isDefault === true) {
            await db
                .update(db_1.schema.customerAddresses)
                .set({ isDefault: false, updatedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.merchantId, merchantId)));
        }
        const patch = { updatedAt: new Date() };
        if (input.label !== undefined)
            patch.label = normalizeLabel(input.label);
        if (input.address !== undefined) {
            const address = String(input.address).trim();
            if (!address)
                throw new Error("Address is required");
            patch.address = address;
        }
        if (input.zipCode !== undefined)
            patch.zipCode = input.zipCode?.trim() || null;
        if (input.city !== undefined)
            patch.city = input.city?.trim() || null;
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
        if (input.isDefault !== undefined)
            patch.isDefault = !!input.isDefault;
        const [row] = await db
            .update(db_1.schema.customerAddresses)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.id, addressId))
            .returning();
        if (row.isDefault) {
            await db
                .update(db_1.schema.customers)
                .set({
                defaultAddress: row.address,
                defaultZip: row.zipCode,
                defaultCity: row.city,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId));
        }
        return publicAddress(row);
    }
    static async deleteAddress(customerId, merchantId, addressId) {
        const db = (0, db_1.getDb)();
        const rows = await db
            .delete(db_1.schema.customerAddresses)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.id, addressId), (0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.merchantId, merchantId)))
            .returning();
        if (!rows.length)
            throw new Error("Address not found");
        if (rows[0].isDefault) {
            const next = await db.query.customerAddresses.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.merchantId, merchantId)),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.customerAddresses.createdAt)],
            });
            if (next) {
                await db
                    .update(db_1.schema.customerAddresses)
                    .set({ isDefault: true, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.customerAddresses.id, next.id));
                await db
                    .update(db_1.schema.customers)
                    .set({
                    defaultAddress: next.address,
                    defaultZip: next.zipCode,
                    defaultCity: next.city,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId));
            }
        }
        return { success: true };
    }
    static publicCustomer(c, addresses = []) {
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
    static async tokenFor(customer) {
        const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email || "";
        const token = auth_service_1.AuthService.generateToken({
            id: customer.id,
            email: customer.email || "",
            role: "customer",
            merchantId: customer.merchantId,
            customerId: customer.id,
            name,
        });
        let addresses = [];
        try {
            addresses = await this.listAddresses(customer.id, customer.merchantId);
        }
        catch {
            /* table may not exist yet during first boot */
        }
        return { token, customer: this.publicCustomer(customer, addresses) };
    }
}
exports.ShopCustomerService = ShopCustomerService;
//# sourceMappingURL=shop-customer.service.js.map