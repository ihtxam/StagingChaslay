"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCustomHtmlEditorState = buildCustomHtmlEditorState;
exports.editorStateFromLegacyCmsBlocks = editorStateFromLegacyCmsBlocks;
exports.maybePersistHomepagePageHeal = maybePersistHomepagePageHeal;
exports.maybePersistHomepageBuilderHeal = maybePersistHomepageBuilderHeal;
exports.maybePersistHomepageSplitBrainHeal = maybePersistHomepageSplitBrainHeal;
exports.repairMerchantChaslayHomepage = repairMerchantChaslayHomepage;
exports.repairChaslayHomepagesBySlug = repairChaslayHomepagesBySlug;
exports.repairAllChaslayHomepages = repairAllChaslayHomepages;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const chaslay_default_template_1 = require("@/lib/chaslay-default-template");
const chaslay_editor_state_1 = require("@/lib/chaslay-editor-state");
const cms_service_1 = require("@/services/cms.service");
/** Wrap legacy OpenPage HTML in a single CustomHTML Craft.js node. */
function buildCustomHtmlEditorState(htmlContent) {
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
function editorStateFromLegacyCmsBlocks(blocks, title) {
    const normalized = (0, cms_service_1.normalizeCmsBlocks)(blocks, title);
    const html = normalized.html?.trim();
    if (html && html.length > 100) {
        try {
            const state = buildCustomHtmlEditorState(html);
            if (!(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(state))
                return state;
        }
        catch {
            /* fall through */
        }
    }
    const blockCount = normalized.config?.blocks?.length ?? 0;
    if (blockCount > 0 && html) {
        try {
            return buildCustomHtmlEditorState(html);
        }
        catch {
            return null;
        }
    }
    return null;
}
/** Resolve homepage editor state and persist builder→page heal when the page row is empty. */
async function maybePersistHomepagePageHeal(homepagePageId, pageState, builderState, pageLastGood, builderLastGood) {
    const resolved = (0, chaslay_editor_state_1.pickPublishedEditorState)(pageState, builderState, pageLastGood, builderLastGood);
    const fromPage = (0, chaslay_editor_state_1.normalizeEditorState)(pageState);
    const fromBuilder = (0, chaslay_editor_state_1.normalizeEditorState)(builderState);
    if (!homepagePageId ||
        !resolved ||
        !fromBuilder ||
        (0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(fromBuilder) ||
        !fromPage ||
        !(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(fromPage) ||
        resolved !== fromBuilder) {
        return { resolved, healed: false };
    }
    const db = (0, db_1.getDb)();
    await db
        .update(db_1.schema.chaslayHomepageBuilderPages)
        .set({
        editorState: fromBuilder,
        lastGoodEditorState: builderLastGood && !(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(builderLastGood)
            ? builderLastGood
            : fromBuilder,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.id, homepagePageId));
    return { resolved, healed: true };
}
/** Persist page→builder heal when the builder row is empty but the homepage page has content. */
async function maybePersistHomepageBuilderHeal(builderId, pageState, builderState, pageLastGood, builderLastGood) {
    const resolved = (0, chaslay_editor_state_1.pickPublishedEditorState)(pageState, builderState, pageLastGood, builderLastGood);
    const fromPage = (0, chaslay_editor_state_1.normalizeEditorState)(pageState);
    const fromBuilder = (0, chaslay_editor_state_1.normalizeEditorState)(builderState);
    if (!builderId ||
        !resolved ||
        !fromPage ||
        (0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(fromPage) ||
        !fromBuilder ||
        !(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(fromBuilder) ||
        resolved !== fromPage) {
        return { resolved, healed: false };
    }
    const db = (0, db_1.getDb)();
    await db
        .update(db_1.schema.chaslayHomepageBuilders)
        .set({
        editorState: fromPage,
        lastGoodEditorState: pageLastGood && !(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(pageLastGood)
            ? pageLastGood
            : fromPage,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, builderId));
    return { resolved, healed: true };
}
/** Heal split-brain in both directions (page row vs builder.editor_state). */
async function maybePersistHomepageSplitBrainHeal(homepagePageId, builderId, pageState, builderState, pageLastGood, builderLastGood) {
    const pageHeal = await maybePersistHomepagePageHeal(homepagePageId, pageState, builderState, pageLastGood, builderLastGood);
    if (pageHeal.healed)
        return pageHeal;
    return maybePersistHomepageBuilderHeal(builderId, pageState, builderState, pageLastGood, builderLastGood);
}
async function loadLegacyPublishedEditorState(merchantId, merchantName) {
    const db = (0, db_1.getDb)();
    const legacyPage = await db.query.cmsPages.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.cmsPages.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.cmsPages.isHomepage, true), (0, drizzle_orm_1.eq)(db_1.schema.cmsPages.status, "published")),
        columns: { title: true, blocks: true },
    });
    if (legacyPage) {
        const fromLegacy = editorStateFromLegacyCmsBlocks(legacyPage.blocks, legacyPage.title);
        if (fromLegacy)
            return fromLegacy;
    }
    const merchant = await db.query.merchants.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        columns: {
            name: true,
            shopLogoUrl: true,
            phone: true,
            address: true,
            city: true,
        },
    });
    if (!merchant)
        return null;
    const address = [merchant.address, merchant.city].filter(Boolean).join(", ");
    const template = (0, chaslay_default_template_1.buildDefaultRestaurantTemplate)({
        merchantName: merchant.name || merchantName,
        logoUrl: merchant.shopLogoUrl,
        phone: merchant.phone,
        address: address || null,
    });
    return (0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(template) ? null : template;
}
async function upsertHomepagePage(merchantId, builderId, editorState, title) {
    const db = (0, db_1.getDb)();
    const homepagePage = await db.query.chaslayHomepageBuilderPages.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.isHomepage, true)),
        columns: { id: true },
    });
    if (homepagePage) {
        await db
            .update(db_1.schema.chaslayHomepageBuilderPages)
            .set({
            editorState,
            lastGoodEditorState: editorState,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.id, homepagePage.id));
        return;
    }
    await db.insert(db_1.schema.chaslayHomepageBuilderPages).values({
        homepageBuilderId: builderId,
        merchantId,
        title,
        slug: "home",
        editorState,
        lastGoodEditorState: editorState,
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
async function repairMerchantChaslayHomepage(merchantId) {
    const db = (0, db_1.getDb)();
    const merchant = await db.query.merchants.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        columns: {
            id: true,
            name: true,
            cmsHomepageEnabled: true,
        },
    });
    if (!merchant?.cmsHomepageEnabled)
        return null;
    const builder = await db.query.chaslayHomepageBuilders.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.isActive, true)),
    });
    if (!builder) {
        const anyBuilder = await db.query.chaslayHomepageBuilders.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId),
        });
        if (anyBuilder) {
            await db
                .update(db_1.schema.chaslayHomepageBuilders)
                .set({ isActive: true, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, anyBuilder.id));
            return repairMerchantChaslayHomepage(merchantId);
        }
        const legacyPage = await db.query.cmsPages.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.cmsPages.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.cmsPages.isHomepage, true), (0, drizzle_orm_1.eq)(db_1.schema.cmsPages.status, "published")),
            columns: { title: true, blocks: true },
        });
        const editorState = await loadLegacyPublishedEditorState(merchantId, merchant.name);
        if (!editorState)
            return null;
        const [created] = await db
            .insert(db_1.schema.chaslayHomepageBuilders)
            .values({
            merchantId,
            name: legacyPage?.title?.trim() || `${merchant.name} Homepage`.trim(),
            editorState,
            lastGoodEditorState: editorState,
            isActive: true,
        })
            .returning();
        await upsertHomepagePage(merchantId, created.id, editorState, legacyPage?.title?.trim() || "Home");
        return {
            merchantId,
            action: legacyPage ? "bootstrapped_from_legacy" : "bootstrapped_default",
        };
    }
    const homepagePage = await db.query.chaslayHomepageBuilderPages.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builder.id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.isHomepage, true)),
        columns: { id: true, editorState: true, lastGoodEditorState: true, title: true },
    });
    const heal = await maybePersistHomepageSplitBrainHeal(homepagePage?.id, builder.id, homepagePage?.editorState ?? null, builder.editorState, homepagePage?.lastGoodEditorState ?? null, builder.lastGoodEditorState);
    if (heal.healed) {
        return { merchantId, action: "split_brain_healed" };
    }
    const resolved = (0, chaslay_editor_state_1.pickPublishedEditorState)(homepagePage?.editorState ?? null, builder.editorState, homepagePage?.lastGoodEditorState ?? null, builder.lastGoodEditorState);
    if (resolved && !(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(resolved)) {
        return { merchantId, action: "ok" };
    }
    const backup = (0, chaslay_editor_state_1.pickPublishedEditorState)(null, null, homepagePage?.lastGoodEditorState ?? null, builder.lastGoodEditorState);
    if (backup && !(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(backup)) {
        await db
            .update(db_1.schema.chaslayHomepageBuilders)
            .set({
            editorState: backup,
            lastGoodEditorState: backup,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, builder.id));
        await upsertHomepagePage(merchantId, builder.id, backup, homepagePage?.title || builder.name || "Home");
        return { merchantId, action: "restored_from_backup" };
    }
    const refill = await loadLegacyPublishedEditorState(merchantId, merchant.name);
    if (!refill)
        return { merchantId, action: "ok" };
    await db
        .update(db_1.schema.chaslayHomepageBuilders)
        .set({
        editorState: refill,
        lastGoodEditorState: refill,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, builder.id));
    await upsertHomepagePage(merchantId, builder.id, refill, homepagePage?.title || builder.name || "Home");
    const action = (await db.query.cmsPages.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.cmsPages.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.cmsPages.isHomepage, true), (0, drizzle_orm_1.eq)(db_1.schema.cmsPages.status, "published")),
        columns: { id: true },
    }))
        ? "empty_refilled"
        : "bootstrapped_default";
    return { merchantId, action };
}
/** Repair Chaslay homepages for merchants matched by shop slug (e.g. demo, brazza-pizza). */
async function repairChaslayHomepagesBySlug(slugs) {
    const db = (0, db_1.getDb)();
    const repaired = [];
    for (const slug of slugs) {
        const normalized = slug.trim().toLowerCase();
        if (!normalized)
            continue;
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.slug, normalized),
            columns: { id: true },
        });
        if (!merchant)
            continue;
        const result = await repairMerchantChaslayHomepage(merchant.id);
        if (result)
            repaired.push(result);
    }
    return repaired;
}
/** Scan merchants with CMS homepage enabled and repair Chaslay builder state. */
async function repairAllChaslayHomepages() {
    const db = (0, db_1.getDb)();
    const merchants = await db.query.merchants.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.cmsHomepageEnabled, true),
        columns: { id: true },
    });
    const repaired = [];
    for (const merchant of merchants) {
        const result = await repairMerchantChaslayHomepage(merchant.id);
        if (result && result.action !== "ok")
            repaired.push(result);
    }
    return { scanned: merchants.length, repaired };
}
//# sourceMappingURL=chaslay-homepage-heal.js.map