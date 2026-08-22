"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformMessageService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
function isActiveWindow(startsAt, endsAt, now = new Date()) {
    if (startsAt && startsAt > now)
        return false;
    if (endsAt && endsAt < now)
        return false;
    return true;
}
function audienceMatches(msg, viewer) {
    const aud = msg.audience;
    if (aud === 'all') {
        return viewer.role === 'merchant' || viewer.role === 'reseller';
    }
    if (aud === 'all_merchants') {
        return viewer.role === 'merchant';
    }
    if (aud === 'all_resellers') {
        return viewer.role === 'reseller';
    }
    if (aud === 'merchant') {
        return viewer.role === 'merchant' && msg.targetMerchantId === viewer.merchantId;
    }
    if (aud === 'reseller') {
        return viewer.role === 'reseller' && msg.targetResellerId === viewer.resellerId;
    }
    return false;
}
class PlatformMessageService {
    static resolveViewer(user) {
        if (!user?.id)
            return null;
        if (user.role === 'superadmin') {
            return { role: 'superadmin', viewerId: user.id };
        }
        if (user.role === 'reseller' && user.resellerId) {
            return { role: 'reseller', viewerId: user.resellerId, resellerId: user.resellerId };
        }
        if ((user.role === 'merchant' || user.role === 'staff') && user.merchantId) {
            return { role: 'merchant', viewerId: user.merchantId, merchantId: user.merchantId };
        }
        return null;
    }
    static async listAll(includeInactive = false) {
        const db = (0, db_1.getDb)();
        return db.query.platformMessages.findMany({
            where: includeInactive ? undefined : (0, drizzle_orm_1.eq)(db_1.schema.platformMessages.isActive, true),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.platformMessages.createdAt)],
            limit: 200,
        });
    }
    static async create(input) {
        const db = (0, db_1.getDb)();
        const kind = (input.kind || 'announcement');
        const showInBanner = input.showInBanner !== undefined ? input.showInBanner : kind === 'incident';
        const showOnLogin = input.showOnLogin !== undefined ? input.showOnLogin : kind !== 'incident';
        const [row] = await db
            .insert(db_1.schema.platformMessages)
            .values({
            kind,
            audience: (input.audience || 'all_merchants'),
            targetMerchantId: input.targetMerchantId || null,
            targetResellerId: input.targetResellerId || null,
            title: input.title.trim().slice(0, 255),
            body: input.body.trim(),
            severity: (input.severity || 'info'),
            externalUrl: input.externalUrl?.trim().slice(0, 500) || null,
            externalLabel: input.externalLabel?.trim().slice(0, 120) || null,
            showOnLogin,
            showInBanner,
            isActive: input.isActive !== false,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            createdBySuperadminId: input.createdBySuperadminId || null,
        })
            .returning();
        return row;
    }
    static async update(id, input) {
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (input.kind !== undefined)
            patch.kind = input.kind;
        if (input.audience !== undefined)
            patch.audience = input.audience;
        if (input.targetMerchantId !== undefined)
            patch.targetMerchantId = input.targetMerchantId || null;
        if (input.targetResellerId !== undefined)
            patch.targetResellerId = input.targetResellerId || null;
        if (input.title !== undefined)
            patch.title = input.title.trim().slice(0, 255);
        if (input.body !== undefined)
            patch.body = input.body.trim();
        if (input.severity !== undefined)
            patch.severity = input.severity;
        if (input.externalUrl !== undefined)
            patch.externalUrl = input.externalUrl?.trim().slice(0, 500) || null;
        if (input.externalLabel !== undefined) {
            patch.externalLabel = input.externalLabel?.trim().slice(0, 120) || null;
        }
        if (input.showOnLogin !== undefined)
            patch.showOnLogin = !!input.showOnLogin;
        if (input.showInBanner !== undefined)
            patch.showInBanner = !!input.showInBanner;
        if (input.isActive !== undefined)
            patch.isActive = !!input.isActive;
        if (input.startsAt !== undefined)
            patch.startsAt = input.startsAt ? new Date(input.startsAt) : null;
        if (input.endsAt !== undefined)
            patch.endsAt = input.endsAt ? new Date(input.endsAt) : null;
        const [row] = await db
            .update(db_1.schema.platformMessages)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.platformMessages.id, id))
            .returning();
        if (!row)
            throw new Error('Message not found');
        return row;
    }
    static async remove(id) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.platformMessages)
            .set({ isActive: false, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.platformMessages.id, id))
            .returning();
        if (!row)
            throw new Error('Message not found');
        return row;
    }
    static async getActiveForViewer(viewer) {
        const db = (0, db_1.getDb)();
        const now = new Date();
        const all = await db.query.platformMessages.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.platformMessages.isActive, true), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(db_1.schema.platformMessages.startsAt), (0, drizzle_orm_1.lte)(db_1.schema.platformMessages.startsAt, now)), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(db_1.schema.platformMessages.endsAt), (0, drizzle_orm_1.gte)(db_1.schema.platformMessages.endsAt, now))),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.platformMessages.createdAt)],
            limit: 100,
        });
        const visible = all.filter((m) => audienceMatches(m, viewer) && isActiveWindow(m.startsAt, m.endsAt, now));
        if (!visible.length) {
            return { messages: [], banner: [], loginPopup: [], unreadCount: 0 };
        }
        const ids = visible.map((m) => m.id);
        const dismissals = await db.query.platformMessageDismissals.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(db_1.schema.platformMessageDismissals.messageId, ids), (0, drizzle_orm_1.eq)(db_1.schema.platformMessageDismissals.viewerRole, viewer.role), (0, drizzle_orm_1.eq)(db_1.schema.platformMessageDismissals.viewerId, viewer.viewerId)),
        });
        const dismissed = new Set(dismissals.map((d) => d.messageId));
        const undismissed = visible.filter((m) => !dismissed.has(m.id));
        return {
            messages: undismissed,
            banner: undismissed.filter((m) => m.showInBanner || m.kind === 'incident'),
            loginPopup: undismissed.filter((m) => m.showOnLogin && m.kind !== 'incident'),
            whatsNew: undismissed.filter((m) => m.kind === 'whats_new' || m.kind === 'announcement'),
            unreadCount: undismissed.length,
        };
    }
    static async dismiss(viewer, messageId) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.platformMessageDismissals.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.platformMessageDismissals.messageId, messageId), (0, drizzle_orm_1.eq)(db_1.schema.platformMessageDismissals.viewerRole, viewer.role), (0, drizzle_orm_1.eq)(db_1.schema.platformMessageDismissals.viewerId, viewer.viewerId)),
        });
        if (!existing) {
            await db.insert(db_1.schema.platformMessageDismissals).values({
                messageId,
                viewerRole: viewer.role,
                viewerId: viewer.viewerId,
            });
        }
    }
    static async dismissAll(viewer, messageIds) {
        if (!messageIds.length)
            return;
        const db = (0, db_1.getDb)();
        for (const messageId of messageIds) {
            const existing = await db.query.platformMessageDismissals.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.platformMessageDismissals.messageId, messageId), (0, drizzle_orm_1.eq)(db_1.schema.platformMessageDismissals.viewerRole, viewer.role), (0, drizzle_orm_1.eq)(db_1.schema.platformMessageDismissals.viewerId, viewer.viewerId)),
            });
            if (!existing) {
                await db.insert(db_1.schema.platformMessageDismissals).values({
                    messageId,
                    viewerRole: viewer.role,
                    viewerId: viewer.viewerId,
                });
            }
        }
    }
}
exports.PlatformMessageService = PlatformMessageService;
//# sourceMappingURL=platform-message.service.js.map