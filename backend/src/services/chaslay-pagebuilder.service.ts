import { and, asc, desc, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { withMerchantSchemaRetry } from "@/lib/ensure-merchant-schema";

const DEFAULT_EMPTY_CANVAS_STATE = JSON.stringify({
  ROOT: {
    type: { resolvedName: "RootContainer" },
    isCanvas: true,
    props: { background: "#ffffff", minHeight: 600 },
    displayName: "RootContainer",
    custom: {},
    hidden: false,
    nodes: [],
    linkedNodes: {},
  },
});

function normalizeEditorState(state?: string | null): string | null {
  if (state == null) return null;
  const trimmed = state.trim();
  if (!trimmed || trimmed === "{}") return null;
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

function editorStateForCreate(state?: string | null): string {
  return normalizeEditorState(state) ?? DEFAULT_EMPTY_CANVAS_STATE;
}

function editorStateForUpdate(state?: string): string | undefined {
  if (state === undefined) return undefined;
  const normalized = normalizeEditorState(state);
  return normalized ?? DEFAULT_EMPTY_CANVAS_STATE;
}

export class ChaslayPagebuilderService {
  /** Prefer the homepage row in chaslay_homepage_builder_pages; fall back to builder.editor_state. */
  private static async resolvePublishedEditorState(
    builderId: number,
    fallback: string | null
  ): Promise<string | null> {
    const db = getDb();
    const homepagePage = await db.query.chaslayHomepageBuilderPages.findFirst({
      where: and(
        eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId),
        eq(schema.chaslayHomepageBuilderPages.isHomepage, true)
      ),
      columns: { editorState: true },
    });
    const fromPage = normalizeEditorState(homepagePage?.editorState);
    if (fromPage) return fromPage;
    return normalizeEditorState(fallback);
  }

  /** Keep builder.editor_state aligned with the homepage page row (editor saves to pages). */
  private static async syncHomepagePageToBuilder(builderId: number, editorState: string | null) {
    const normalized = normalizeEditorState(editorState);
    if (!normalized) return;
    const db = getDb();
    await db
      .update(schema.chaslayHomepageBuilders)
      .set({ editorState: normalized, updatedAt: new Date() })
      .where(eq(schema.chaslayHomepageBuilders.id, builderId));
  }

  static async list(merchantId: string) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const rows = await db.query.chaslayHomepageBuilders.findMany({
        where: eq(schema.chaslayHomepageBuilders.merchantId, merchantId),
        orderBy: [desc(schema.chaslayHomepageBuilders.isActive), desc(schema.chaslayHomepageBuilders.updatedAt)],
        columns: {
          id: true,
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        is_active: r.isActive,
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      }));
    });
  }

  static async get(merchantId: string, id: number) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const row = await db.query.chaslayHomepageBuilders.findFirst({
        where: and(
          eq(schema.chaslayHomepageBuilders.id, id),
          eq(schema.chaslayHomepageBuilders.merchantId, merchantId)
        ),
      });
      if (!row) throw new Error("Homepage builder not found");
      return {
        id: row.id,
        name: row.name,
        editor_state: row.editorState,
        is_active: row.isActive,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      };
    });
  }

  static async getActive(merchantId: string) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const row = await db.query.chaslayHomepageBuilders.findFirst({
        where: and(
          eq(schema.chaslayHomepageBuilders.merchantId, merchantId),
          eq(schema.chaslayHomepageBuilders.isActive, true)
        ),
      });
      if (!row) return null;
      const editor_state = await this.resolvePublishedEditorState(row.id, row.editorState);
      return {
        id: row.id,
        name: row.name,
        editor_state,
        is_active: row.isActive,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      };
    });
  }

  static async create(merchantId: string, input: { name: string; editor_state?: string | null }) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.chaslayHomepageBuilders)
        .values({
          merchantId,
          name: input.name,
          editorState: editorStateForCreate(input.editor_state),
          isActive: false,
        })
        .returning();
      return {
        id: row.id,
        name: row.name,
        editor_state: row.editorState,
        is_active: row.isActive,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      };
    });
  }

  static async update(
    merchantId: string,
    id: number,
    input: { name?: string; editor_state?: string }
  ) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const patch: Partial<typeof schema.chaslayHomepageBuilders.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) patch.name = input.name;
      if (input.editor_state !== undefined) patch.editorState = editorStateForUpdate(input.editor_state);
      const [row] = await db
        .update(schema.chaslayHomepageBuilders)
        .set(patch)
        .where(
          and(eq(schema.chaslayHomepageBuilders.id, id), eq(schema.chaslayHomepageBuilders.merchantId, merchantId))
        )
        .returning();
      if (!row) throw new Error("Homepage builder not found");
      return {
        id: row.id,
        name: row.name,
        editor_state: row.editorState,
        is_active: row.isActive,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      };
    });
  }

  static async remove(merchantId: string, id: number) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const deleted = await db
        .delete(schema.chaslayHomepageBuilders)
        .where(
          and(eq(schema.chaslayHomepageBuilders.id, id), eq(schema.chaslayHomepageBuilders.merchantId, merchantId))
        )
        .returning({ id: schema.chaslayHomepageBuilders.id });
      if (!deleted.length) throw new Error("Homepage builder not found");
    });
  }

  static async activate(merchantId: string, id: number) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const existing = await db.query.chaslayHomepageBuilders.findFirst({
        where: and(eq(schema.chaslayHomepageBuilders.id, id), eq(schema.chaslayHomepageBuilders.merchantId, merchantId)),
      });
      if (!existing) throw new Error("Homepage builder not found");
      await db
        .update(schema.chaslayHomepageBuilders)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(eq(schema.chaslayHomepageBuilders.merchantId, merchantId), ne(schema.chaslayHomepageBuilders.id, id))
        );
      const [row] = await db
        .update(schema.chaslayHomepageBuilders)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(schema.chaslayHomepageBuilders.id, id))
        .returning();
      const publishedState = await this.resolvePublishedEditorState(row.id, row.editorState);
      if (publishedState && publishedState !== row.editorState) {
        await this.syncHomepagePageToBuilder(row.id, publishedState);
      }
      await db
        .update(schema.merchants)
        .set({ cmsHomepageEnabled: true, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
      return { id: row.id, name: row.name, is_active: true };
    });
  }

  static async deactivate(merchantId: string, id: number) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const [row] = await db
        .update(schema.chaslayHomepageBuilders)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(eq(schema.chaslayHomepageBuilders.id, id), eq(schema.chaslayHomepageBuilders.merchantId, merchantId))
        )
        .returning();
      if (!row) throw new Error("Homepage builder not found");
      const otherActive = await db.query.chaslayHomepageBuilders.findFirst({
        where: and(
          eq(schema.chaslayHomepageBuilders.merchantId, merchantId),
          eq(schema.chaslayHomepageBuilders.isActive, true)
        ),
        columns: { id: true },
      });
      if (!otherActive) {
        await db
          .update(schema.merchants)
          .set({ cmsHomepageEnabled: false, updatedAt: new Date() })
          .where(eq(schema.merchants.id, merchantId));
      }
      return { id: row.id, name: row.name, is_active: false };
    });
  }

  static async listPages(merchantId: string, builderId: number) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      await this.assertBuilder(merchantId, builderId);
      const rows = await db.query.chaslayHomepageBuilderPages.findMany({
        where: eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId),
        orderBy: [asc(schema.chaslayHomepageBuilderPages.sortOrder)],
      });
      return rows.map((p) => ({
        id: p.id,
        homepage_builder_id: p.homepageBuilderId,
        title: p.title,
        slug: p.slug,
        editor_state: p.editorState,
        is_homepage: p.isHomepage,
        sort_order: p.sortOrder,
      }));
    });
  }

  static async createPage(
    merchantId: string,
    builderId: number,
    input: {
      title: string;
      slug: string;
      editor_state?: string | null;
      is_homepage?: boolean;
      sort_order?: number;
    }
  ) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      await this.assertBuilder(merchantId, builderId);
      const slugExists = await db.query.chaslayHomepageBuilderPages.findFirst({
        where: and(
          eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId),
          eq(schema.chaslayHomepageBuilderPages.slug, input.slug)
        ),
      });
      if (slugExists) throw new Error("A page with this slug already exists for this builder.");
      if (input.is_homepage) {
        await db
          .update(schema.chaslayHomepageBuilderPages)
          .set({ isHomepage: false })
          .where(eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId));
      }
      const [row] = await db
        .insert(schema.chaslayHomepageBuilderPages)
        .values({
          homepageBuilderId: builderId,
          merchantId,
          title: input.title,
          slug: input.slug,
          editorState: editorStateForCreate(input.editor_state),
          isHomepage: input.is_homepage ?? false,
          sortOrder: input.sort_order ?? 0,
        })
        .returning();
      return {
        id: row.id,
        homepage_builder_id: row.homepageBuilderId,
        title: row.title,
        slug: row.slug,
        editor_state: row.editorState,
        is_homepage: row.isHomepage,
        sort_order: row.sortOrder,
      };
    });
  }

  static async updatePage(
    merchantId: string,
    builderId: number,
    pageId: number,
    input: Partial<{
      title: string;
      slug: string;
      editor_state: string;
      is_homepage: boolean;
      sort_order: number;
    }>
  ) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      await this.assertBuilder(merchantId, builderId);
      const page = await db.query.chaslayHomepageBuilderPages.findFirst({
        where: and(
          eq(schema.chaslayHomepageBuilderPages.id, pageId),
          eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId)
        ),
      });
      if (!page) throw new Error("Page not found");
      if (input.slug && input.slug !== page.slug) {
        const slugExists = await db.query.chaslayHomepageBuilderPages.findFirst({
          where: and(
            eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId),
            eq(schema.chaslayHomepageBuilderPages.slug, input.slug),
            ne(schema.chaslayHomepageBuilderPages.id, pageId)
          ),
        });
        if (slugExists) throw new Error("A page with this slug already exists for this builder.");
      }
      if (input.is_homepage) {
        await db
          .update(schema.chaslayHomepageBuilderPages)
          .set({ isHomepage: false })
          .where(
            and(
              eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId),
              ne(schema.chaslayHomepageBuilderPages.id, pageId)
            )
          );
      }
      const patch: Partial<typeof schema.chaslayHomepageBuilderPages.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.title !== undefined) patch.title = input.title;
      if (input.slug !== undefined) patch.slug = input.slug;
      if (input.editor_state !== undefined) patch.editorState = editorStateForUpdate(input.editor_state);
      if (input.is_homepage !== undefined) patch.isHomepage = input.is_homepage;
      if (input.sort_order !== undefined) patch.sortOrder = input.sort_order;
      const [row] = await db
        .update(schema.chaslayHomepageBuilderPages)
        .set(patch)
        .where(eq(schema.chaslayHomepageBuilderPages.id, pageId))
        .returning();
      if (row.isHomepage && (input.editor_state !== undefined || input.is_homepage === true)) {
        await this.syncHomepagePageToBuilder(builderId, row.editorState);
      }
      return {
        id: row.id,
        homepage_builder_id: row.homepageBuilderId,
        title: row.title,
        slug: row.slug,
        editor_state: row.editorState,
        is_homepage: row.isHomepage,
        sort_order: row.sortOrder,
      };
    });
  }

  static async removePage(merchantId: string, builderId: number, pageId: number) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      await this.assertBuilder(merchantId, builderId);
      const page = await db.query.chaslayHomepageBuilderPages.findFirst({
        where: and(
          eq(schema.chaslayHomepageBuilderPages.id, pageId),
          eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId)
        ),
      });
      if (!page) throw new Error("Page not found");
      if (page.isHomepage) throw new Error("Cannot delete the homepage. Set another page as homepage first.");
      const count = await db.query.chaslayHomepageBuilderPages.findMany({
        where: eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId),
        columns: { id: true },
      });
      if (count.length <= 1) throw new Error("Cannot delete the last remaining page.");
      await db.delete(schema.chaslayHomepageBuilderPages).where(eq(schema.chaslayHomepageBuilderPages.id, pageId));
    });
  }

  private static async assertBuilder(merchantId: string, builderId: number) {
    const db = getDb();
    const row = await db.query.chaslayHomepageBuilders.findFirst({
      where: and(
        eq(schema.chaslayHomepageBuilders.id, builderId),
        eq(schema.chaslayHomepageBuilders.merchantId, merchantId)
      ),
      columns: { id: true },
    });
    if (!row) throw new Error("Homepage builder not found");
  }

  /** Published pages from the merchant's active builder layout (empty when none active). */
  static async listActivePublishedPages(merchantId: string) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const builder = await db.query.chaslayHomepageBuilders.findFirst({
        where: and(
          eq(schema.chaslayHomepageBuilders.merchantId, merchantId),
          eq(schema.chaslayHomepageBuilders.isActive, true)
        ),
        columns: { id: true, name: true, updatedAt: true },
      });
      if (!builder) return [];
      const rows = await db.query.chaslayHomepageBuilderPages.findMany({
        where: eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builder.id),
        orderBy: [asc(schema.chaslayHomepageBuilderPages.sortOrder)],
        columns: {
          id: true,
          title: true,
          slug: true,
          isHomepage: true,
          sortOrder: true,
          updatedAt: true,
        },
      });
      return rows.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        is_homepage: p.isHomepage,
        sort_order: p.sortOrder,
        updated_at: p.updatedAt.toISOString(),
        builder_id: builder.id,
        builder_name: builder.name,
        builder_updated_at: builder.updatedAt.toISOString(),
      }));
    });
  }

  /** Resolve one published page from the active builder by slug (`home` maps to homepage row). */
  static async getActivePublishedPage(merchantId: string, pageSlug: string) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const builder = await db.query.chaslayHomepageBuilders.findFirst({
        where: and(
          eq(schema.chaslayHomepageBuilders.merchantId, merchantId),
          eq(schema.chaslayHomepageBuilders.isActive, true)
        ),
      });
      if (!builder) return null;
      const normalizedSlug = pageSlug === "home" ? null : pageSlug;
      const page = normalizedSlug
        ? await db.query.chaslayHomepageBuilderPages.findFirst({
            where: and(
              eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builder.id),
              eq(schema.chaslayHomepageBuilderPages.slug, normalizedSlug)
            ),
          })
        : await db.query.chaslayHomepageBuilderPages.findFirst({
            where: and(
              eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builder.id),
              eq(schema.chaslayHomepageBuilderPages.isHomepage, true)
            ),
          });
      if (!page) return null;
      const editor_state = normalizeEditorState(page.editorState);
      if (!editor_state) return null;
      return {
        builder_id: builder.id,
        builder_name: builder.name,
        id: page.id,
        title: page.title,
        slug: page.isHomepage ? "home" : page.slug,
        is_homepage: page.isHomepage,
        editor_state,
        updated_at: page.updatedAt.toISOString(),
      };
    });
  }
}
