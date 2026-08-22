import { and, desc, eq, inArray, isNull, lte, or, sql, gte } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type {
  PlatformMessageAudience,
  PlatformMessageKind,
  PlatformMessageSeverity,
} from '@/db/schema';

export type PlatformMessageInput = {
  kind?: PlatformMessageKind;
  audience?: PlatformMessageAudience;
  targetMerchantId?: string | null;
  targetResellerId?: string | null;
  title: string;
  body: string;
  severity?: PlatformMessageSeverity;
  externalUrl?: string | null;
  externalLabel?: string | null;
  showOnLogin?: boolean;
  showInBanner?: boolean;
  isActive?: boolean;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  createdBySuperadminId?: string | null;
};

export type PanelViewer = {
  role: 'merchant' | 'reseller' | 'superadmin';
  viewerId: string;
  merchantId?: string | null;
  resellerId?: string | null;
};

function isActiveWindow(startsAt?: Date | null, endsAt?: Date | null, now = new Date()) {
  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;
  return true;
}

function audienceMatches(
  msg: typeof schema.platformMessages.$inferSelect,
  viewer: PanelViewer
): boolean {
  const aud = msg.audience as PlatformMessageAudience;
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

export class PlatformMessageService {
  static resolveViewer(user?: {
    role?: string;
    id?: string;
    merchantId?: string;
    resellerId?: string;
  }): PanelViewer | null {
    if (!user?.id) return null;
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
    const db = getDb();
    return db.query.platformMessages.findMany({
      where: includeInactive ? undefined : eq(schema.platformMessages.isActive, true),
      orderBy: [desc(schema.platformMessages.createdAt)],
      limit: 200,
    });
  }

  static async create(input: PlatformMessageInput) {
    const db = getDb();
    const kind = (input.kind || 'announcement') as PlatformMessageKind;
    const showInBanner =
      input.showInBanner !== undefined ? input.showInBanner : kind === 'incident';
    const showOnLogin =
      input.showOnLogin !== undefined ? input.showOnLogin : kind !== 'incident';

    const [row] = await db
      .insert(schema.platformMessages)
      .values({
        kind,
        audience: (input.audience || 'all_merchants') as PlatformMessageAudience,
        targetMerchantId: input.targetMerchantId || null,
        targetResellerId: input.targetResellerId || null,
        title: input.title.trim().slice(0, 255),
        body: input.body.trim(),
        severity: (input.severity || 'info') as PlatformMessageSeverity,
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
    return row!;
  }

  static async update(id: string, input: Partial<PlatformMessageInput>) {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.kind !== undefined) patch.kind = input.kind;
    if (input.audience !== undefined) patch.audience = input.audience;
    if (input.targetMerchantId !== undefined) patch.targetMerchantId = input.targetMerchantId || null;
    if (input.targetResellerId !== undefined) patch.targetResellerId = input.targetResellerId || null;
    if (input.title !== undefined) patch.title = input.title.trim().slice(0, 255);
    if (input.body !== undefined) patch.body = input.body.trim();
    if (input.severity !== undefined) patch.severity = input.severity;
    if (input.externalUrl !== undefined) patch.externalUrl = input.externalUrl?.trim().slice(0, 500) || null;
    if (input.externalLabel !== undefined) {
      patch.externalLabel = input.externalLabel?.trim().slice(0, 120) || null;
    }
    if (input.showOnLogin !== undefined) patch.showOnLogin = !!input.showOnLogin;
    if (input.showInBanner !== undefined) patch.showInBanner = !!input.showInBanner;
    if (input.isActive !== undefined) patch.isActive = !!input.isActive;
    if (input.startsAt !== undefined) patch.startsAt = input.startsAt ? new Date(input.startsAt) : null;
    if (input.endsAt !== undefined) patch.endsAt = input.endsAt ? new Date(input.endsAt) : null;

    const [row] = await db
      .update(schema.platformMessages)
      .set(patch)
      .where(eq(schema.platformMessages.id, id))
      .returning();
    if (!row) throw new Error('Message not found');
    return row;
  }

  static async remove(id: string) {
    const db = getDb();
    const [row] = await db
      .update(schema.platformMessages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.platformMessages.id, id))
      .returning();
    if (!row) throw new Error('Message not found');
    return row;
  }

  static async getActiveForViewer(viewer: PanelViewer) {
    const db = getDb();
    const now = new Date();
    const all = await db.query.platformMessages.findMany({
      where: and(
        eq(schema.platformMessages.isActive, true),
        or(isNull(schema.platformMessages.startsAt), lte(schema.platformMessages.startsAt, now)),
        or(isNull(schema.platformMessages.endsAt), gte(schema.platformMessages.endsAt, now))
      ),
      orderBy: [desc(schema.platformMessages.createdAt)],
      limit: 100,
    });

    const visible = all.filter((m) => audienceMatches(m, viewer) && isActiveWindow(m.startsAt, m.endsAt, now));
    if (!visible.length) {
      return { messages: [], banner: [], loginPopup: [], unreadCount: 0 };
    }

    const ids = visible.map((m) => m.id);
    const dismissals = await db.query.platformMessageDismissals.findMany({
      where: and(
        inArray(schema.platformMessageDismissals.messageId, ids),
        eq(schema.platformMessageDismissals.viewerRole, viewer.role),
        eq(schema.platformMessageDismissals.viewerId, viewer.viewerId)
      ),
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

  static async dismiss(viewer: PanelViewer, messageId: string) {
    const db = getDb();
    const existing = await db.query.platformMessageDismissals.findFirst({
      where: and(
        eq(schema.platformMessageDismissals.messageId, messageId),
        eq(schema.platformMessageDismissals.viewerRole, viewer.role),
        eq(schema.platformMessageDismissals.viewerId, viewer.viewerId)
      ),
    });
    if (!existing) {
      await db.insert(schema.platformMessageDismissals).values({
        messageId,
        viewerRole: viewer.role,
        viewerId: viewer.viewerId,
      });
    }
  }

  static async dismissAll(viewer: PanelViewer, messageIds: string[]) {
    if (!messageIds.length) return;
    const db = getDb();
    for (const messageId of messageIds) {
      const existing = await db.query.platformMessageDismissals.findFirst({
        where: and(
          eq(schema.platformMessageDismissals.messageId, messageId),
          eq(schema.platformMessageDismissals.viewerRole, viewer.role),
          eq(schema.platformMessageDismissals.viewerId, viewer.viewerId)
        ),
      });
      if (!existing) {
        await db.insert(schema.platformMessageDismissals).values({
          messageId,
          viewerRole: viewer.role,
          viewerId: viewer.viewerId,
        });
      }
    }
  }
}
