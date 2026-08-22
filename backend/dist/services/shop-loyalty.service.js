"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopLoyaltyService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
class ShopLoyaltyService {
    static programFromMerchant(merchant) {
        const earn = Number(merchant.loyaltyEarnPointsPerChf ?? 1);
        const redeem = Number(merchant.loyaltyRedeemPointsPerChf ?? 100);
        const expiry = Number(merchant.loyaltyPointsExpiryDays ?? 30);
        return {
            enabled: !!merchant.loyaltyEnabled,
            earnPointsPerChf: Number.isFinite(earn) && earn > 0 ? earn : 1,
            redeemPointsPerChf: Number.isFinite(redeem) && redeem >= 1 ? Math.floor(redeem) : 100,
            expiryDays: Number.isFinite(expiry) && expiry >= 1 ? Math.floor(expiry) : 30,
        };
    }
    static async getProgram(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        return this.programFromMerchant(merchant);
    }
    static async updateProgram(merchantId, updates) {
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (updates.enabled !== undefined)
            patch.loyaltyEnabled = !!updates.enabled;
        if (updates.earnPointsPerChf !== undefined) {
            const n = Number(updates.earnPointsPerChf);
            if (!Number.isFinite(n) || n <= 0 || n > 1000) {
                throw new Error("earnPointsPerChf must be between 0 exclusive and 1000");
            }
            patch.loyaltyEarnPointsPerChf = n.toFixed(3);
        }
        if (updates.redeemPointsPerChf !== undefined) {
            const n = Math.floor(Number(updates.redeemPointsPerChf));
            if (!Number.isFinite(n) || n < 1 || n > 100000) {
                throw new Error("redeemPointsPerChf must be between 1 and 100000");
            }
            patch.loyaltyRedeemPointsPerChf = n;
        }
        if (updates.expiryDays !== undefined) {
            const n = Math.floor(Number(updates.expiryDays));
            if (!Number.isFinite(n) || n < 1 || n > 3650) {
                throw new Error("expiryDays must be between 1 and 3650");
            }
            patch.loyaltyPointsExpiryDays = n;
        }
        const [merchant] = await db
            .update(db_1.schema.merchants)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId))
            .returning();
        return this.programFromMerchant(merchant);
    }
    /** Expire lots past expiresAt and sync customers.loyaltyPoints cache. */
    static async expireAndSync(merchantId, customerId) {
        const db = (0, db_1.getDb)();
        const now = new Date();
        const expired = await db.query.loyaltyPointLots.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.customerId, customerId), (0, drizzle_orm_1.gt)(db_1.schema.loyaltyPointLots.pointsRemaining, 0), (0, drizzle_orm_1.lte)(db_1.schema.loyaltyPointLots.expiresAt, now)),
        });
        for (const lot of expired) {
            if (lot.pointsRemaining <= 0)
                continue;
            await db
                .update(db_1.schema.loyaltyPointLots)
                .set({ pointsRemaining: 0 })
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.id, lot.id));
            await db.insert(db_1.schema.loyaltyPointEvents).values({
                merchantId,
                customerId,
                orderId: lot.orderId,
                eventType: "expire",
                points: -lot.pointsRemaining,
                meta: { lotId: lot.id, expiredAt: now.toISOString() },
            });
        }
        return this.syncBalanceCache(merchantId, customerId);
    }
    static async syncBalanceCache(merchantId, customerId) {
        const db = (0, db_1.getDb)();
        const now = new Date();
        const lots = await db.query.loyaltyPointLots.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.customerId, customerId), (0, drizzle_orm_1.gt)(db_1.schema.loyaltyPointLots.pointsRemaining, 0), (0, drizzle_orm_1.gt)(db_1.schema.loyaltyPointLots.expiresAt, now)),
        });
        const balance = lots.reduce((s, l) => s + (l.pointsRemaining || 0), 0);
        await db
            .update(db_1.schema.customers)
            .set({ loyaltyPoints: balance, updatedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customerId), (0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchantId)));
        return balance;
    }
    static async getBalance(merchantId, customerId) {
        return this.expireAndSync(merchantId, customerId);
    }
    static computeEarnPoints(paidFoodSubtotalChf, earnPointsPerChf) {
        const base = Math.max(0, Number(paidFoodSubtotalChf) || 0);
        return Math.floor(base * earnPointsPerChf);
    }
    static computeCashDiscount(points, redeemPointsPerChf) {
        const pts = Math.max(0, Math.floor(points));
        const rate = Math.max(1, Math.floor(redeemPointsPerChf));
        const discountChf = Math.floor(pts / rate);
        const pointsUsed = discountChf * rate;
        return { discountChf, pointsUsed };
    }
    /** Max points redeemable as cash against a payable CHF base (food, fees, tax — not tip). */
    static maxRedeemablePoints(payableChf, balance, redeemPointsPerChf) {
        const rate = Math.max(1, Math.floor(redeemPointsPerChf));
        const maxByPayable = Math.floor(Math.max(0, payableChf)) * rate;
        const maxByBalance = Math.floor(balance / rate) * rate;
        return Math.min(maxByPayable, maxByBalance);
    }
    static async earnPoints(opts) {
        const points = Math.floor(opts.points);
        if (points <= 0)
            return { balance: await this.getBalance(opts.merchantId, opts.customerId), points: 0 };
        const db = (0, db_1.getDb)();
        await this.expireAndSync(opts.merchantId, opts.customerId);
        const earnedAt = new Date();
        const expiresAt = new Date(earnedAt.getTime() + opts.expiryDays * 24 * 60 * 60 * 1000);
        await db.insert(db_1.schema.loyaltyPointLots).values({
            merchantId: opts.merchantId,
            customerId: opts.customerId,
            orderId: opts.orderId || null,
            pointsGranted: points,
            pointsRemaining: points,
            earnedAt,
            expiresAt,
            source: opts.source || "earn",
        });
        await db.insert(db_1.schema.loyaltyPointEvents).values({
            merchantId: opts.merchantId,
            customerId: opts.customerId,
            orderId: opts.orderId || null,
            eventType: "earn",
            points,
            meta: { expiresAt: expiresAt.toISOString() },
        });
        const balance = await this.syncBalanceCache(opts.merchantId, opts.customerId);
        return { balance, points, expiresAt };
    }
    /** Burn points FIFO from oldest lots. */
    static async redeemPoints(opts) {
        const need = Math.floor(opts.points);
        if (need <= 0)
            return { balance: await this.getBalance(opts.merchantId, opts.customerId) };
        const db = (0, db_1.getDb)();
        const balance = await this.expireAndSync(opts.merchantId, opts.customerId);
        if (balance < need)
            throw new Error("Insufficient loyalty points");
        const now = new Date();
        const lots = await db.query.loyaltyPointLots.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.merchantId, opts.merchantId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.customerId, opts.customerId), (0, drizzle_orm_1.gt)(db_1.schema.loyaltyPointLots.pointsRemaining, 0), (0, drizzle_orm_1.gt)(db_1.schema.loyaltyPointLots.expiresAt, now)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.loyaltyPointLots.expiresAt), (0, drizzle_orm_1.asc)(db_1.schema.loyaltyPointLots.earnedAt)],
        });
        let remaining = need;
        for (const lot of lots) {
            if (remaining <= 0)
                break;
            const take = Math.min(lot.pointsRemaining, remaining);
            await db
                .update(db_1.schema.loyaltyPointLots)
                .set({ pointsRemaining: lot.pointsRemaining - take })
                .where((0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.id, lot.id));
            remaining -= take;
        }
        if (remaining > 0)
            throw new Error("Insufficient loyalty points");
        await db.insert(db_1.schema.loyaltyPointEvents).values({
            merchantId: opts.merchantId,
            customerId: opts.customerId,
            orderId: opts.orderId || null,
            productId: opts.productId || null,
            eventType: opts.eventType,
            points: -need,
            meta: opts.meta || {},
        });
        const next = await this.syncBalanceCache(opts.merchantId, opts.customerId);
        return { balance: next, points: need };
    }
    static async listRewardProducts(merchantId, balance) {
        const db = (0, db_1.getDb)();
        const products = await db.query.products.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.isActive, true), (0, drizzle_orm_1.isNotNull)(db_1.schema.products.loyaltyRewardPoints), (0, drizzle_orm_1.gt)(db_1.schema.products.loyaltyRewardPoints, 0)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.products.loyaltyRewardPoints), (0, drizzle_orm_1.asc)(db_1.schema.products.name)],
        });
        return products.map((p) => {
            const cost = Number(p.loyaltyRewardPoints) || 0;
            return {
                id: p.id,
                name: p.name,
                image: p.imageUrl,
                price: parseFloat(p.price.toString()),
                loyaltyRewardPoints: cost,
                unlocked: balance >= cost,
            };
        });
    }
    static async getCustomerLoyaltySummary(merchantId, customerId) {
        const program = await this.getProgram(merchantId);
        // Always sync/show balance on account — earn/redeem still gated by program.enabled
        const balance = await this.getBalance(merchantId, customerId);
        const rewards = program.enabled ? await this.listRewardProducts(merchantId, balance) : [];
        const unlocked = rewards.filter((r) => r.unlocked);
        const next = rewards.find((r) => !r.unlocked) || null;
        const nextCost = next?.loyaltyRewardPoints ?? null;
        const progress = nextCost && nextCost > 0 ? Math.min(1, balance / nextCost) : unlocked.length ? 1 : 0;
        const db = (0, db_1.getDb)();
        const now = new Date();
        const lots = await db.query.loyaltyPointLots.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.loyaltyPointLots.customerId, customerId), (0, drizzle_orm_1.gt)(db_1.schema.loyaltyPointLots.pointsRemaining, 0), (0, drizzle_orm_1.gt)(db_1.schema.loyaltyPointLots.expiresAt, now)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.loyaltyPointLots.expiresAt)],
            limit: 5,
        });
        const expiringSoon = lots[0]
            ? {
                points: lots[0].pointsRemaining,
                expiresAt: lots[0].expiresAt,
            }
            : null;
        return {
            program,
            balance,
            rewards,
            unlockedRewards: unlocked,
            nextReward: next,
            progress,
            progressPercent: Math.round(progress * 100),
            expiringSoon,
            formula: {
                earn: `${program.earnPointsPerChf} pt per CHF spent (food subtotal)`,
                redeem: `${program.redeemPointsPerChf} pts = CHF 1.00 discount`,
                expiry: `${program.expiryDays} days (oldest first)`,
            },
        };
    }
    /** Public program + rewards (no customer) for menu bar when logged out. */
    static async getPublicLoyalty(merchantId) {
        const program = await this.getProgram(merchantId);
        const rewards = program.enabled ? await this.listRewardProducts(merchantId, 0) : [];
        return { program, rewards };
    }
}
exports.ShopLoyaltyService = ShopLoyaltyService;
//# sourceMappingURL=shop-loyalty.service.js.map