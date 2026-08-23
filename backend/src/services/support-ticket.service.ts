import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, inArray, lte } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { ensureUploadsRoot } from '@/services/media-upload.service';

const TICKET_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const SUPPORT_MIME: Record<string, string> = {
  'text/plain': '.txt',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/bmp': '.bmp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function nextTicketNumber(): Promise<string> {
  const db = getDb();
  const n = Math.floor(Date.now() / 1000) % 1000000;
  const candidate = `T${n}`;
  const existing = await db.query.supportTickets.findFirst({
    where: eq(schema.supportTickets.ticketNumber, candidate),
    columns: { id: true },
  });
  if (!existing) return candidate;
  return `T${n}-${Math.floor(Math.random() * 90 + 10)}`;
}

export async function saveSupportAttachment(opts: {
  merchantId: string;
  ticketId: string;
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<{ url: string; name: string }> {
  const ext = SUPPORT_MIME[opts.mimeType.toLowerCase()];
  if (!ext) throw new Error('File type not allowed. Use txt, jpg, png, bmp, gif, or pdf.');
  if (!opts.buffer?.length) throw new Error('Empty file');
  if (opts.buffer.length > 8 * 1024 * 1024) throw new Error('Attachment must be 8 MB or smaller');

  const root = ensureUploadsRoot();
  const dir = path.join(root, opts.merchantId, 'support', opts.ticketId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await fs.promises.writeFile(path.join(dir, filename), opts.buffer);
  return {
    url: `/api/uploads/${opts.merchantId}/support/${opts.ticketId}/${filename}`,
    name: opts.originalName || filename,
  };
}

export class SupportTicketService {
  /** Close tickets older than 3 days. */
  static async autoCloseExpired(ticketIds?: string[]) {
    const db = getDb();
    const now = new Date();
    const where = [
      inArray(schema.supportTickets.status, ['open', 'answered']),
      lte(schema.supportTickets.autoCloseAt, now),
    ];
    if (ticketIds?.length) {
      where.push(inArray(schema.supportTickets.id, ticketIds));
    }
    const expired = await db.query.supportTickets.findMany({
      where: and(...where),
      columns: { id: true },
    });
    for (const t of expired) {
      await db
        .update(schema.supportTickets)
        .set({ status: 'closed', closedAt: now, updatedAt: now })
        .where(eq(schema.supportTickets.id, t.id));
      await db.insert(schema.supportTicketMessages).values({
        ticketId: t.id,
        authorRole: 'system',
        authorName: 'System',
        body: 'This ticket was automatically closed after 3 days. Please open a new ticket if you still need help.',
      });
    }
    return expired.length;
  }

  static async createTicket(
    merchantId: string,
    input: {
      category: string;
      subcategory?: string;
      subject: string;
      body: string;
      attachment?: { url: string; name: string } | null;
      authorName?: string;
      authorId?: string;
      /** Superadmin-only tickets (POS diagnostic logs). Default true. */
      merchantVisible?: boolean;
    }
  ) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { id: true, name: true, resellerId: true },
    });
    if (!merchant) throw new Error('Merchant not found');

    const now = new Date();
    const ticketNumber = await nextTicketNumber();
    const [ticket] = await db
      .insert(schema.supportTickets)
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

    await db.insert(schema.supportTicketMessages).values({
      ticketId: ticket!.id,
      authorRole: 'merchant',
      authorId: input.authorId || merchantId,
      authorName: input.authorName || merchant.name,
      body: input.body.trim(),
      attachmentUrl: input.attachment?.url || null,
      attachmentName: input.attachment?.name || null,
    });

    return ticket!;
  }

  /** Internal POS/Web diagnostic report — superadmin inbox only, not merchant-visible. */
  static async createDiagnosticReport(
    merchantId: string,
    input: {
      source: 'webpos' | 'android';
      subject: string;
      body: string;
      auto?: boolean;
      authorName?: string;
    }
  ) {
    const subcategory = input.auto ? `${input.source}-auto` : input.source;
    return this.createTicket(merchantId, {
      category: 'technical',
      subcategory,
      subject: input.subject.trim().slice(0, 255),
      body: input.body,
      authorName: input.authorName || 'POS diagnostics',
      merchantVisible: false,
    });
  }

  static async setFirstMessageAttachment(
    ticketId: string,
    attachment: { url: string; name: string }
  ) {
    const db = getDb();
    const first = await db.query.supportTicketMessages.findFirst({
      where: eq(schema.supportTicketMessages.ticketId, ticketId),
      orderBy: [asc(schema.supportTicketMessages.createdAt)],
    });
    if (!first) return;
    await db
      .update(schema.supportTicketMessages)
      .set({
        attachmentUrl: attachment.url,
        attachmentName: attachment.name,
      })
      .where(eq(schema.supportTicketMessages.id, first.id));
  }

  static async listMerchantTickets(merchantId: string, status?: string) {
    await this.autoCloseExpired();
    const db = getDb();
    const where = [
      eq(schema.supportTickets.merchantId, merchantId),
      eq(schema.supportTickets.merchantVisible, true),
    ];
    if (status && status !== 'all') {
      where.push(eq(schema.supportTickets.status, status));
    }
    return db.query.supportTickets.findMany({
      where: and(...where),
      orderBy: [desc(schema.supportTickets.lastMessageAt)],
      limit: 100,
    });
  }

  static async listResellerTickets(resellerId: string, status?: string) {
    await this.autoCloseExpired();
    const db = getDb();
    const where = [eq(schema.supportTickets.resellerId, resellerId)];
    if (status && status !== 'all') {
      where.push(eq(schema.supportTickets.status, status));
    }
    return db.query.supportTickets.findMany({
      where: and(...where),
      orderBy: [desc(schema.supportTickets.lastMessageAt)],
      limit: 200,
      with: { merchant: { columns: { id: true, name: true, email: true } } },
    });
  }

  static async listAllTickets(opts?: { status?: string; category?: string; assignedTo?: string }) {
    await this.autoCloseExpired();
    const db = getDb();
    const where = [];
    if (opts?.status && opts.status !== 'all') {
      where.push(eq(schema.supportTickets.status, opts.status));
    }
    if (opts?.category) {
      where.push(eq(schema.supportTickets.category, opts.category));
    }
    if (opts?.assignedTo) {
      where.push(eq(schema.supportTickets.assignedToSuperadminId, opts.assignedTo));
    }
    return db.query.supportTickets.findMany({
      where: where.length ? and(...where) : undefined,
      orderBy: [desc(schema.supportTickets.lastMessageAt)],
      limit: 300,
      with: {
        merchant: { columns: { id: true, name: true, email: true } },
        reseller: { columns: { id: true, name: true } },
      },
    });
  }

  static async getTicketWithMessages(ticketId: string, scope?: {
    merchantId?: string;
    resellerId?: string;
  }) {
    await this.autoCloseExpired([ticketId]);
    const db = getDb();
    const ticket = await db.query.supportTickets.findFirst({
      where: eq(schema.supportTickets.id, ticketId),
      with: {
        messages: { orderBy: [asc(schema.supportTicketMessages.createdAt)] },
        merchant: { columns: { id: true, name: true, email: true } },
        reseller: { columns: { id: true, name: true } },
      },
    });
    if (!ticket) throw new Error('Ticket not found');
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

  static async addReply(
    ticketId: string,
    input: {
      authorRole: 'merchant' | 'reseller' | 'superadmin' | 'system';
      authorId?: string;
      authorName?: string;
      body: string;
      attachment?: { url: string; name: string } | null;
      closeTicket?: boolean;
    },
    scope?: { merchantId?: string; resellerId?: string }
  ) {
    const db = getDb();
    const ticket = await this.getTicketWithMessages(ticketId, scope);
    if (ticket.status === 'closed') {
      throw new Error('Ticket is closed. Please open a new ticket.');
    }

    const now = new Date();
    await db.insert(schema.supportTicketMessages).values({
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
      .update(schema.supportTickets)
      .set({
        status: newStatus,
        lastMessageAt: now,
        updatedAt: now,
        closedAt: newStatus === 'closed' ? now : ticket.closedAt,
        autoCloseAt: addDays(now, 3),
      })
      .where(eq(schema.supportTickets.id, ticketId));

    return this.getTicketWithMessages(ticketId, scope);
  }

  static async assignTicket(ticketId: string, superadminId: string | null) {
    const db = getDb();
    const [row] = await db
      .update(schema.supportTickets)
      .set({
        assignedToSuperadminId: superadminId,
        updatedAt: new Date(),
      })
      .where(eq(schema.supportTickets.id, ticketId))
      .returning();
    if (!row) throw new Error('Ticket not found');
    return row;
  }

  static async listSupportAgents() {
    const db = getDb();
    return db.query.superadmins.findMany({
      where: and(eq(schema.superadmins.isActive, true), eq(schema.superadmins.handlesSupport, true)),
      columns: { id: true, name: true, email: true, handlesSupport: true },
      orderBy: [asc(schema.superadmins.name)],
    });
  }

  static async setSupportAgent(superadminId: string, handlesSupport: boolean) {
    const db = getDb();
    const [row] = await db
      .update(schema.superadmins)
      .set({ handlesSupport: !!handlesSupport, updatedAt: new Date() })
      .where(eq(schema.superadmins.id, superadminId))
      .returning({
        id: schema.superadmins.id,
        name: schema.superadmins.name,
        email: schema.superadmins.email,
        handlesSupport: schema.superadmins.handlesSupport,
      });
    if (!row) throw new Error('User not found');
    return row;
  }

  static async listSuperadminsForSupportMgmt() {
    const db = getDb();
    return db.query.superadmins.findMany({
      where: eq(schema.superadmins.isActive, true),
      columns: { id: true, name: true, email: true, handlesSupport: true, role: true },
      orderBy: [asc(schema.superadmins.name)],
    });
  }
}
