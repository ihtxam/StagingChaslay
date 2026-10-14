import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  parseSoftwareReleaseInput,
  type SoftwareReleaseInput,
} from "@/lib/software-release";

function serialize(row: typeof schema.softwareReleases.$inferSelect) {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    body: row.body || "",
    product: row.product,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SoftwareReleaseService {
  static async listPublished() {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.softwareReleases)
      .where(eq(schema.softwareReleases.isPublished, true))
      .orderBy(desc(schema.softwareReleases.publishedAt));
    return rows.map(serialize);
  }

  static async listAll() {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.softwareReleases)
      .orderBy(desc(schema.softwareReleases.publishedAt));
    return rows.map(serialize);
  }

  static async latestPublished() {
    const [first] = await this.listPublished();
    return first || null;
  }

  static async create(input: SoftwareReleaseInput & { createdBySuperadminId?: string | null }) {
    const parsed = parseSoftwareReleaseInput(input, true);
    const db = getDb();
    const [row] = await db
      .insert(schema.softwareReleases)
      .values({
        version: parsed.version!,
        title: parsed.title!,
        body: parsed.body || "",
        product: parsed.product || "all",
        isPublished: parsed.isPublished !== false,
        publishedAt: parsed.publishedAt && !Number.isNaN(parsed.publishedAt.getTime())
          ? parsed.publishedAt
          : new Date(),
        createdBySuperadminId: input.createdBySuperadminId || null,
      })
      .returning();
    return serialize(row);
  }

  static async update(id: string, input: SoftwareReleaseInput) {
    const parsed = parseSoftwareReleaseInput(input, false);
    const db = getDb();
    const patch: Partial<typeof schema.softwareReleases.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (parsed.version) patch.version = parsed.version;
    if (parsed.title) patch.title = parsed.title;
    if (parsed.body !== undefined) patch.body = parsed.body;
    if (parsed.product) patch.product = parsed.product;
    if (parsed.isPublished !== undefined) patch.isPublished = parsed.isPublished;
    if (parsed.publishedAt && !Number.isNaN(parsed.publishedAt.getTime())) {
      patch.publishedAt = parsed.publishedAt;
    }
    const [row] = await db
      .update(schema.softwareReleases)
      .set(patch)
      .where(eq(schema.softwareReleases.id, id))
      .returning();
    if (!row) throw new Error("Release not found");
    return serialize(row);
  }

  static async remove(id: string) {
    const db = getDb();
    const [row] = await db
      .delete(schema.softwareReleases)
      .where(eq(schema.softwareReleases.id, id))
      .returning();
    if (!row) throw new Error("Release not found");
    return serialize(row);
  }
}
