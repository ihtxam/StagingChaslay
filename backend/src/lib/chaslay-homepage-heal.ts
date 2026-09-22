import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { buildDefaultRestaurantTemplate } from "@/lib/chaslay-default-template";
import {
  isEffectivelyEmptyEditorState,
  normalizeEditorState,
  pickPublishedEditorState,
} from "@/lib/chaslay-editor-state";
import { normalizeCmsBlocks } from "@/services/cms.service";

/** Wrap legacy OpenPage HTML in a single CustomHTML Craft.js node. */
export function buildCustomHtmlEditorState(htmlContent: string): string {
  const trimmed = htmlContent.trim();
  if (!trimmed) {
    throw new Error("htmlContent is required");
  }
  const nodeId = "legacy-html-1";
  return JSON.stringify({
    ROOT: {
      type: { resolvedName: "RootContainer" },
      isCanvas: true,
      props: { background: "#ffffff", minHeight: 600 },
      displayName: "RootContainer",
      custom: {},
      hidden: false,
      nodes: [nodeId],
      linkedNodes: {},
    },
    [nodeId]: {
      type: { resolvedName: "CustomHTML" },
      isCanvas: true,
      props: {
        htmlContent: trimmed,
        backgroundColor: "#ffffff",
        padding: 16,
        maxWidth: 1350,
      },
      displayName: "CustomHTML",
      custom: {},
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: "ROOT",
    },
  });
}

export function editorStateFromLegacyCmsBlocks(blocks: unknown, title: string): string | null {
  const normalized = normalizeCmsBlocks(blocks, title);
  const html = normalized.html?.trim();
  if (html && html.length > 100) {
    try {
      const state = buildCustomHtmlEditorState(html);
      if (!isEffectivelyEmptyEditorState(state)) return state;
    } catch {
      /* fall through */
    }
  }
  const blockCount = normalized.config?.blocks?.length ?? 0;
  if (blockCount > 0 && html) {
    try {
      return buildCustomHtmlEditorState(html);
    } catch {
      return null;
    }
  }
  return null;
}

export type HomepageHealResult = {
  resolved: string | null;
  healed: boolean;
};

/** Resolve homepage editor state and persist builder→page heal when the page row is empty. */
export async function maybePersistHomepagePageHeal(
  homepagePageId: number | null | undefined,
  pageState: string | null,
  builderState: string | null
): Promise<HomepageHealResult> {
  const resolved = pickPublishedEditorState(pageState, builderState);
  const fromPage = normalizeEditorState(pageState);
  const fromBuilder = normalizeEditorState(builderState);
  if (
    !homepagePageId ||
    !resolved ||
    !fromBuilder ||
    isEffectivelyEmptyEditorState(fromBuilder) ||
    !fromPage ||
    !isEffectivelyEmptyEditorState(fromPage) ||
    resolved !== fromBuilder
  ) {
    return { resolved, healed: false };
  }

  const db = getDb();
  await db
    .update(schema.chaslayHomepageBuilderPages)
    .set({ editorState: fromBuilder, updatedAt: new Date() })
    .where(eq(schema.chaslayHomepageBuilderPages.id, homepagePageId));
  return { resolved, healed: true };
}

/** Persist page→builder heal when the builder row is empty but the homepage page has content. */
export async function maybePersistHomepageBuilderHeal(
  builderId: number | null | undefined,
  pageState: string | null,
  builderState: string | null
): Promise<HomepageHealResult> {
  const resolved = pickPublishedEditorState(pageState, builderState);
  const fromPage = normalizeEditorState(pageState);
  const fromBuilder = normalizeEditorState(builderState);
  if (
    !builderId ||
    !resolved ||
    !fromPage ||
    isEffectivelyEmptyEditorState(fromPage) ||
    !fromBuilder ||
    !isEffectivelyEmptyEditorState(fromBuilder) ||
    resolved !== fromPage
  ) {
    return { resolved, healed: false };
  }

  const db = getDb();
  await db
    .update(schema.chaslayHomepageBuilders)
    .set({ editorState: fromPage, updatedAt: new Date() })
    .where(eq(schema.chaslayHomepageBuilders.id, builderId));
  return { resolved, healed: true };
}

/** Heal split-brain in both directions (page row vs builder.editor_state). */
export async function maybePersistHomepageSplitBrainHeal(
  homepagePageId: number | null | undefined,
  builderId: number | null | undefined,
  pageState: string | null,
  builderState: string | null
): Promise<HomepageHealResult> {
  const pageHeal = await maybePersistHomepagePageHeal(homepagePageId, pageState, builderState);
  if (pageHeal.healed) return pageHeal;
  return maybePersistHomepageBuilderHeal(builderId, pageState, builderState);
}

export type MerchantHomepageRepairResult = {
  merchantId: string;
  action: "ok" | "split_brain_healed" | "empty_refilled" | "bootstrapped_from_legacy" | "bootstrapped_default";
};

async function loadLegacyPublishedEditorState(
  merchantId: string,
  merchantName: string
): Promise<string | null> {
  const db = getDb();
  const legacyPage = await db.query.cmsPages.findFirst({
    where: and(
      eq(schema.cmsPages.merchantId, merchantId),
      eq(schema.cmsPages.isHomepage, true),
      eq(schema.cmsPages.status, "published")
    ),
    columns: { title: true, blocks: true },
  });
  if (legacyPage) {
    const fromLegacy = editorStateFromLegacyCmsBlocks(legacyPage.blocks, legacyPage.title);
    if (fromLegacy) return fromLegacy;
  }

  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: {
      name: true,
      shopLogoUrl: true,
      phone: true,
      address: true,
      city: true,
    },
  });
  if (!merchant) return null;
  const address = [merchant.address, merchant.city].filter(Boolean).join(", ");
  const template = buildDefaultRestaurantTemplate({
    merchantName: merchant.name || merchantName,
    logoUrl: merchant.shopLogoUrl,
    phone: merchant.phone,
    address: address || null,
  });
  return isEffectivelyEmptyEditorState(template) ? null : template;
}

async function upsertHomepagePage(
  merchantId: string,
  builderId: number,
  editorState: string,
  title: string
): Promise<void> {
  const db = getDb();
  const homepagePage = await db.query.chaslayHomepageBuilderPages.findFirst({
    where: and(
      eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId),
      eq(schema.chaslayHomepageBuilderPages.isHomepage, true)
    ),
    columns: { id: true },
  });
  if (homepagePage) {
    await db
      .update(schema.chaslayHomepageBuilderPages)
      .set({ editorState, updatedAt: new Date() })
      .where(eq(schema.chaslayHomepageBuilderPages.id, homepagePage.id));
    return;
  }
  await db.insert(schema.chaslayHomepageBuilderPages).values({
    homepageBuilderId: builderId,
    merchantId,
    title,
    slug: "home",
    editorState,
    isHomepage: true,
    sortOrder: 0,
  });
}

/**
 * Repair one merchant's Chaslay homepage:
 * - bootstrap missing builder from legacy CMS or default template
 * - heal split-brain (builder has content, homepage page row empty)
 * - refill fully empty active builder from legacy CMS when available
 */
export async function repairMerchantChaslayHomepage(
  merchantId: string
): Promise<MerchantHomepageRepairResult | null> {
  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: {
      id: true,
      name: true,
      cmsHomepageEnabled: true,
    },
  });
  if (!merchant?.cmsHomepageEnabled) return null;

  const builder = await db.query.chaslayHomepageBuilders.findFirst({
    where: and(
      eq(schema.chaslayHomepageBuilders.merchantId, merchantId),
      eq(schema.chaslayHomepageBuilders.isActive, true)
    ),
  });

  if (!builder) {
    const anyBuilder = await db.query.chaslayHomepageBuilders.findFirst({
      where: eq(schema.chaslayHomepageBuilders.merchantId, merchantId),
    });
    if (anyBuilder) {
      await db
        .update(schema.chaslayHomepageBuilders)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(schema.chaslayHomepageBuilders.id, anyBuilder.id));
      return repairMerchantChaslayHomepage(merchantId);
    }

    const legacyPage = await db.query.cmsPages.findFirst({
      where: and(
        eq(schema.cmsPages.merchantId, merchantId),
        eq(schema.cmsPages.isHomepage, true),
        eq(schema.cmsPages.status, "published")
      ),
      columns: { title: true, blocks: true },
    });
    const editorState = await loadLegacyPublishedEditorState(merchantId, merchant.name);
    if (!editorState) return null;

    const [created] = await db
      .insert(schema.chaslayHomepageBuilders)
      .values({
        merchantId,
        name: legacyPage?.title?.trim() || `${merchant.name} Homepage`.trim(),
        editorState,
        isActive: true,
      })
      .returning();
    await upsertHomepagePage(
      merchantId,
      created.id,
      editorState,
      legacyPage?.title?.trim() || "Home"
    );
    return {
      merchantId,
      action: legacyPage ? "bootstrapped_from_legacy" : "bootstrapped_default",
    };
  }

  const homepagePage = await db.query.chaslayHomepageBuilderPages.findFirst({
    where: and(
      eq(schema.chaslayHomepageBuilderPages.homepageBuilderId, builder.id),
      eq(schema.chaslayHomepageBuilderPages.isHomepage, true)
    ),
    columns: { id: true, editorState: true, title: true },
  });

  const heal = await maybePersistHomepageSplitBrainHeal(
    homepagePage?.id,
    builder.id,
    homepagePage?.editorState ?? null,
    builder.editorState
  );
  if (heal.healed) {
    return { merchantId, action: "split_brain_healed" };
  }

  const resolved = pickPublishedEditorState(
    homepagePage?.editorState ?? null,
    builder.editorState
  );
  if (resolved && !isEffectivelyEmptyEditorState(resolved)) {
    return { merchantId, action: "ok" };
  }

  const refill = await loadLegacyPublishedEditorState(merchantId, merchant.name);
  if (!refill) return { merchantId, action: "ok" };

  await db
    .update(schema.chaslayHomepageBuilders)
    .set({ editorState: refill, updatedAt: new Date() })
    .where(eq(schema.chaslayHomepageBuilders.id, builder.id));
  await upsertHomepagePage(
    merchantId,
    builder.id,
    refill,
    homepagePage?.title || builder.name || "Home"
  );
  const action = (await db.query.cmsPages.findFirst({
    where: and(
      eq(schema.cmsPages.merchantId, merchantId),
      eq(schema.cmsPages.isHomepage, true),
      eq(schema.cmsPages.status, "published")
    ),
    columns: { id: true },
  }))
    ? "empty_refilled"
    : "bootstrapped_default";
  return { merchantId, action };
}

/** Repair Chaslay homepages for merchants matched by shop slug (e.g. demo, brazza-pizza). */
export async function repairChaslayHomepagesBySlug(
  slugs: string[]
): Promise<MerchantHomepageRepairResult[]> {
  const db = getDb();
  const repaired: MerchantHomepageRepairResult[] = [];
  for (const slug of slugs) {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) continue;
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.slug, normalized),
      columns: { id: true },
    });
    if (!merchant) continue;
    const result = await repairMerchantChaslayHomepage(merchant.id);
    if (result) repaired.push(result);
  }
  return repaired;
}

/** Scan merchants with CMS homepage enabled and repair Chaslay builder state. */
export async function repairAllChaslayHomepages(): Promise<{
  scanned: number;
  repaired: MerchantHomepageRepairResult[];
}> {
  const db = getDb();
  const merchants = await db.query.merchants.findMany({
    where: eq(schema.merchants.cmsHomepageEnabled, true),
    columns: { id: true },
  });
  const repaired: MerchantHomepageRepairResult[] = [];
  for (const merchant of merchants) {
    const result = await repairMerchantChaslayHomepage(merchant.id);
    if (result && result.action !== "ok") repaired.push(result);
  }
  return { scanned: merchants.length, repaired };
}
