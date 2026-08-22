import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { PlatformLogLevel } from '@/db/schema';

export type PlatformLogInput = {
  level?: PlatformLogLevel;
  category?: string;
  message: string;
  metadata?: Record<string, unknown>;
  actorRole?: string | null;
  actorId?: string | null;
  merchantId?: string | null;
  resellerId?: string | null;
};

export class PlatformLogService {
  static async write(input: PlatformLogInput) {
    const db = getDb();
    const [row] = await db
      .insert(schema.platformEventLogs)
      .values({
        level: input.level || 'info',
        category: String(input.category || 'system').slice(0, 80),
        message: input.message,
        metadata: input.metadata || null,
        actorRole: input.actorRole?.slice(0, 20) || null,
        actorId: input.actorId || null,
        merchantId: input.merchantId || null,
        resellerId: input.resellerId || null,
      })
      .returning();
    return row!;
  }

  static async list(opts?: {
    page?: number;
    limit?: number;
    level?: string;
    category?: string;
    from?: Date;
    to?: Date;
  }) {
    const db = getDb();
    const page = Math.max(1, Number(opts?.page) || 1);
    const limit = Math.min(Math.max(Number(opts?.limit) || 50, 1), 200);
    const offset = (page - 1) * limit;

    const where = [];
    if (opts?.level) where.push(eq(schema.platformEventLogs.level, opts.level));
    if (opts?.category) where.push(eq(schema.platformEventLogs.category, opts.category));
    if (opts?.from) where.push(gte(schema.platformEventLogs.createdAt, opts.from));
    if (opts?.to) where.push(lte(schema.platformEventLogs.createdAt, opts.to));

    const rows = await db.query.platformEventLogs.findMany({
      where: where.length ? and(...where) : undefined,
      orderBy: [desc(schema.platformEventLogs.createdAt)],
      limit,
      offset,
    });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.platformEventLogs)
      .where(where.length ? and(...where) : undefined);

    return { logs: rows, page, limit, total: Number(count) || 0 };
  }
}
