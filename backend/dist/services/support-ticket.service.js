"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportTicketService = void 0;
exports.saveSupportAttachment = saveSupportAttachment;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const media_upload_service_1 = require("@/services/media-upload.service");
const TICKET_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const SUPPORT_MIME = {
    'text/plain': '.txt',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/bmp': '.bmp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
};
function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}
async function nextTicketNumber() {
    const db = (0, db_1.getDb)();
    const n = Math.floor(Date.now() / 1000) % 1000000;
    const candidate = `T${n}`;
    const existing = await db.query.supportTickets.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.supportTickets.ticketNumber, candidate),
        columns: { id: true },
    });
    if (!existing)
        return candidate;
    return `T${n}-${Math.floor(Math.random() * 90 + 10)}`;
}
async function saveSupportAttachment(opts) {
    const ext = SUPPORT_MIME[opts.mimeType.toLowerCase()];
    if (!ext)
        throw new Error('File type not allowed. Use txt, jpg, png, bmp, gif, or pdf.');
    if (!opts.buffer?.length)
        throw new Error('Empty file');
    if (opts.buffer.length > 8 * 1024 * 1024)
        throw new Error('Attachment must be 8 MB or smaller');
    const root = (0, media_upload_service_1.ensureUploadsRoot)();
    const dir = path_1.default.join(root, opts.merchantId, 'support', opts.ticketId);
    fs_1.default.mkdirSync(dir, { recursive: true });
    const filename = `${(0, crypto_1.randomUUID)()}${ext}`;
    await fs_1.default.promises.writeFile(path_1.default.join(dir, filename), opts.buffer);
    return {
        url: `/api/uploads/${opts.merchantId}/support/${opts.ticketId}/${filename}`,
        name: opts.originalName || filename,
    };
}
class SupportTicketService {
    /** Close tickets older than 3 days. */
    static async autoCloseExpired(ticketIds) {
        const db = (0, db_1.getDb)();
        const now = new Date();
        const where = [
            (0, drizzle_orm_1.inArray)(db_1.schema.supportTickets.status, ['open', 'answered']),
            (0, drizzle_orm_1.lte)(db_1.schema.supportTickets.autoCloseAt, now),
        ];
        if (ticketIds?.length) {
            where.push((0, drizzle_orm_1.inArray)(db_1.schema.supportTickets.id, ticketIds));
        }
        const expired = await db.query.supportTickets.findMany({
            where: (0, drizzle_orm_1.and)(...where),
            columns: { id: true },
        });
        for (const t of expired) {
            await db
                .update(db_1.schema.supportTickets)
                .set({ status: 'closed', closedAt: now, updatedAt: now })
                .where((0, drizzle_orm_1.eq)(db_1.schema.supportTickets.id, t.id));
            await db.insert(db_1.schema.supportTicketMessages).values({
                ticketId: t.id,
                authorRole: 'system',
                authorName: 'System',
                body: 'This ticket was automatically closed after 3 days. Please open a new ticket if you still need help.',
            });
        }
        return expired.length;
    }
    static async createTicket(merchantId, input) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { id: true, name: true, resellerId: true },
        });
        if (!merchant)
            throw new Error('Merchant not found');
        const now = new Date();
        const ticketNumber = await nextTicketNumber();
        const [ticket] = await db
            .insert(db_1.schema.supportTickets)
            .values({
            ticketNumber,
            merchantId,
            resellerId: merchant.resellerId,
            category: String(input.category || 'technical').slice(0, 30),
            subcategory: input.subcategory?.slice(0, 80) || null,
            subject: input.subject.trim().slice(0, 255),
            status: 'open',
            merchantVisible: input.merchantVisible !== false,
            lastMessageAt: now,
            autoCloseAt: addDays(now, 3),
        })
            .returning();
        await db.insert(db_1.schema.supportTicketMessages).values({
            ticketId: ticket.id,
            authorRole: 'merchant',
            authorId: input.authorId || merchantId,
            authorName: input.authorName || merchant.name,
            body: input.body.trim(),
            attachmentUrl: input.attachment?.url || null,
            attachmentName: input.attachment?.name || null,
        });
        return ticket;
    }
    /** Internal POS/Web diagnostic report — platform System Logs only (not support inbox). */
    static async createDiagnosticReport(merchantId, input) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { id: true, resellerId: true },
        });
        if (!merchant)
            throw new Error('Merchant not found');
        const { PlatformLogService } = await Promise.resolve().then(() => __importStar(require('@/services/platform-log.service')));
        const log = await PlatformLogService.writeMerchantDiagnostic(merchantId, {
            source: input.source,
            subject: input.subject,
            body: input.body,
            auto: input.auto,
            authorName: input.authorName,
            actorId: input.actorId,
            resellerId: merchant.resellerId,
        });
        return log;
    }
    static async setFirstMessageAttachment(ticketId, attachment) {
        const db = (0, db_1.getDb)();
        const first = await db.query.supportTicketMessages.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.supportTicketMessages.ticketId, ticketId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.supportTicketMessages.createdAt)],
        });
        if (!first)
            return;
        await db
            .update(db_1.schema.supportTicketMessages)
            .set({
            attachmentUrl: attachment.url,
            attachmentName: attachment.name,
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.supportTicketMessages.id, first.id));
    }
    static async listMerchantTickets(merchantId, status) {
        await this.autoCloseExpired();
        const db = (0, db_1.getDb)();
        const where = [
            (0, drizzle_orm_1.eq)(db_1.schema.supportTickets.merchantId, merchantId),
            (0, drizzle_orm_1.eq)(db_1.schema.supportTickets.merchantVisible, true),
        ];
        if (status && status !== 'all') {
            where.push((0, drizzle_orm_1.eq)(db_1.schema.supportTickets.status, status));
        }
        return db.query.supportTickets.findMany({
            where: (0, drizzle_orm_1.and)(...where),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.supportTickets.lastMessageAt)],
            limit: 100,
        });
    }
    static async listResellerTickets(resellerId, status) {
        await this.autoCloseExpired();
        const db = (0, db_1.getDb)();
        const where = [
            (0, drizzle_orm_1.eq)(db_1.schema.supportTickets.resellerId, resellerId),
            (0, drizzle_orm_1.eq)(db_1.schema.supportTickets.merchantVisible, true),
        ];
        if (status && status !== 'all') {
            where.push((0, drizzle_orm_1.eq)(db_1.schema.supportTickets.status, status));
        }
        return db.query.supportTickets.findMany({
            where: (0, drizzle_orm_1.and)(...where),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.supportTickets.lastMessageAt)],
            limit: 200,
            with: { merchant: { columns: { id: true, name: true, email: true } } },
        });
    }
    static async listAllTickets(opts) {
        await this.autoCloseExpired();
        const db = (0, db_1.getDb)();
        const where = [(0, drizzle_orm_1.eq)(db_1.schema.supportTickets.merchantVisible, true)];
        if (opts?.status && opts.status !== 'all') {
            where.push((0, drizzle_orm_1.eq)(db_1.schema.supportTickets.status, opts.status));
        }
        if (opts?.category) {
            where.push((0, drizzle_orm_1.eq)(db_1.schema.supportTickets.category, opts.category));
        }
        if (opts?.assignedTo) {
            where.push((0, drizzle_orm_1.eq)(db_1.schema.supportTickets.assignedToSuperadminId, opts.assignedTo));
        }
        return db.query.supportTickets.findMany({
            where: where.length ? (0, drizzle_orm_1.and)(...where) : undefined,
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.supportTickets.lastMessageAt)],
            limit: 300,
            with: {
                merchant: { columns: { id: true, name: true, email: true } },
                reseller: { columns: { id: true, name: true } },
            },
        });
    }
    static async getTicketWithMessages(ticketId, scope) {
        await this.autoCloseExpired([ticketId]);
        const db = (0, db_1.getDb)();
        const ticket = await db.query.supportTickets.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.supportTickets.id, ticketId),
            with: {
                messages: { orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.supportTicketMessages.createdAt)] },
                merchant: { columns: { id: true, name: true, email: true } },
                reseller: { columns: { id: true, name: true } },
            },
        });
        if (!ticket)
            throw new Error('Ticket not found');
        if (scope?.merchantId && ticket.merchantId !== scope.merchantId) {
            throw new Error('Ticket not found');
        }
        if (scope?.merchantId && ticket.merchantVisible === false) {
            throw new Error('Ticket not found');
        }
        if (scope?.resellerId && ticket.resellerId !== scope.resellerId) {
            throw new Error('Ticket not found');
        }
        return ticket;
    }
    static async addReply(ticketId, input, scope) {
        const db = (0, db_1.getDb)();
        const ticket = await this.getTicketWithMessages(ticketId, scope);
        if (ticket.status === 'closed') {
            throw new Error('Ticket is closed. Please open a new ticket.');
        }
        const now = new Date();
        await db.insert(db_1.schema.supportTicketMessages).values({
            ticketId,
            authorRole: input.authorRole,
            authorId: input.authorId || null,
            authorName: input.authorName?.slice(0, 255) || null,
            body: input.body.trim(),
            attachmentUrl: input.attachment?.url || null,
            attachmentName: input.attachment?.name || null,
        });
        const newStatus = input.closeTicket
            ? 'closed'
            : input.authorRole === 'merchant'
                ? 'open'
                : 'answered';
        await db
            .update(db_1.schema.supportTickets)
            .set({
            status: newStatus,
            lastMessageAt: now,
            updatedAt: now,
            closedAt: newStatus === 'closed' ? now : ticket.closedAt,
            autoCloseAt: addDays(now, 3),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.supportTickets.id, ticketId));
        return this.getTicketWithMessages(ticketId, scope);
    }
    static async assignTicket(ticketId, superadminId) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.supportTickets)
            .set({
            assignedToSuperadminId: superadminId,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.supportTickets.id, ticketId))
            .returning();
        if (!row)
            throw new Error('Ticket not found');
        return row;
    }
    static async listSupportAgents() {
        const db = (0, db_1.getDb)();
        return db.query.superadmins.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.superadmins.isActive, true), (0, drizzle_orm_1.eq)(db_1.schema.superadmins.handlesSupport, true)),
            columns: { id: true, name: true, email: true, handlesSupport: true },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.superadmins.name)],
        });
    }
    static async setSupportAgent(superadminId, handlesSupport) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.superadmins)
            .set({ handlesSupport: !!handlesSupport, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.superadmins.id, superadminId))
            .returning({
            id: db_1.schema.superadmins.id,
            name: db_1.schema.superadmins.name,
            email: db_1.schema.superadmins.email,
            handlesSupport: db_1.schema.superadmins.handlesSupport,
        });
        if (!row)
            throw new Error('User not found');
        return row;
    }
    static async listSuperadminsForSupportMgmt() {
        const db = (0, db_1.getDb)();
        return db.query.superadmins.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.superadmins.isActive, true),
            columns: { id: true, name: true, email: true, handlesSupport: true, role: true },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.superadmins.name)],
        });
    }
}
exports.SupportTicketService = SupportTicketService;
//# sourceMappingURL=support-ticket.service.js.map