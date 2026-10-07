"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChaslayPagebuilderService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const chaslay_default_template_1 = require("@/lib/chaslay-default-template");
const chaslay_editor_state_1 = require("@/lib/chaslay-editor-state");
const chaslay_homepage_heal_1 = require("@/lib/chaslay-homepage-heal");
const cms_service_1 = require("@/services/cms.service");
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
function editorStateForCreate(state) {
    const editorState = (0, chaslay_editor_state_1.normalizeEditorState)(state) ?? DEFAULT_EMPTY_CANVAS_STATE;
    const patch = { editorState };
    if (!(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(editorState)) {
        patch.lastGoodEditorState = editorState;
    }
    return patch;
}
class ChaslayPagebuilderService {
    /**
     * Auto-bootstrap from legacy CMS is disabled on production by default.
     * Client website content must not be created or replaced without explicit merchant action.
     * Set CHASLAY_AUTO_BOOTSTRAP=1 to allow on any env, or run outside NODE_ENV=production.
     */
    static isAutoBootstrapAllowed() {
        if (process.env.CHASLAY_AUTO_BOOTSTRAP === "1")
            return true;
        return process.env.NODE_ENV !== "production";
    }
    /** Prefer homepage page row when it has real blocks; fall back to builder.editor_state. */
    static async resolvePublishedEditorState(builderId, fallback) {
        const db = (0, db_1.getDb)();
        const builder = await db.query.chaslayHomepageBuilders.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, builderId),
            columns: { editorState: true, lastGoodEditorState: true },
        });
        const homepagePage = await db.query.chaslayHomepageBuilderPages.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.isHomepage, true)),
            columns: { id: true, editorState: true, lastGoodEditorState: true },
        });
        const heal = await (0, chaslay_homepage_heal_1.maybePersistHomepageSplitBrainHeal)(homepagePage?.id, builderId, homepagePage?.editorState ?? null, builder?.editorState ?? fallback, homepagePage?.lastGoodEditorState ?? null, builder?.lastGoodEditorState ?? null);
        return (heal.resolved ??
            (0, chaslay_editor_state_1.pickPublishedEditorState)(homepagePage?.editorState ?? null, builder?.editorState ?? fallback, homepagePage?.lastGoodEditorState ?? null, builder?.lastGoodEditorState ?? null));
    }
    /** Repair missing/wiped Chaslay state before reads (legacy CMS bootstrap, split-brain heal). */
    static async ensureHomepageRepaired(merchantId) {
        await (0, chaslay_homepage_heal_1.repairMerchantChaslayHomepage)(merchantId);
    }
    /** Keep builder.editor_state aligned with the homepage page row (editor saves to pages). */
    static async syncHomepagePageToBuilder(builderId, editorState, lastGoodEditorState) {
        const normalized = (0, chaslay_editor_state_1.normalizeEditorState)(editorState);
        if (!normalized || (0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(normalized))
            return;
        const db = (0, db_1.getDb)();
        const patch = {
            editorState: normalized,
            updatedAt: new Date(),
        };
        if (lastGoodEditorState && !(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(lastGoodEditorState)) {
            patch.lastGoodEditorState = lastGoodEditorState;
        }
        else if (!(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(normalized)) {
            patch.lastGoodEditorState = normalized;
        }
        await db
            .update(db_1.schema.chaslayHomepageBuilders)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, builderId));
    }
    /** One-time bootstrap when a merchant had the classic CMS homepage but no Chaslay builder yet. */
    static async ensureBootstrappedFromLegacy(merchantId) {
        // NEVER auto-create or overwrite client CMS layouts on production.
        // Merchants must opt in explicitly (CHASLAY_AUTO_BOOTSTRAP=1) or use non-production env.
        if (!ChaslayPagebuilderService.isAutoBootstrapAllowed())
            return false;
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            const db = (0, db_1.getDb)();
            const existing = await db.query.chaslayHomepageBuilders.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId),
                columns: { id: true },
            });
            if (existing)
                return false;
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
                columns: {
                    id: true,
                    name: true,
                    cmsHomepageEnabled: true,
                    shopLogoUrl: true,
                    phone: true,
                    address: true,
                    city: true,
                },
            });
            if (!merchant)
                return false;
            const legacyPage = await cms_service_1.CmsService.getPublishedHomepage(merchantId);
            if (!merchant.cmsHomepageEnabled && !legacyPage)
                return false;
            const name = legacyPage?.title?.trim() || `${merchant.name} Homepage`.trim();
            const address = [merchant.address, merchant.city].filter(Boolean).join(", ");
            const editorState = (0, chaslay_default_template_1.buildDefaultRestaurantTemplate)({
                merchantName: merchant.name,
                logoUrl: merchant.shopLogoUrl,
                phone: merchant.phone,
                address: address || null,
            });
            const builder = await this.create(merchantId, { name, editor_state: editorState });
            await this.createPage(merchantId, builder.id, {
                title: name,
                slug: "home",
                editor_state: editorState,
                is_homepage: true,
                sort_order: 0,
            });
            await this.activate(merchantId, builder.id);
            return true;
        });
    }
    static async list(merchantId) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            await this.ensureBootstrappedFromLegacy(merchantId);
            await this.ensureHomepageRepaired(merchantId);
            const db = (0, db_1.getDb)();
            const rows = await db.query.chaslayHomepageBuilders.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId),
                orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.chaslayHomepageBuilders.isActive), (0, drizzle_orm_1.desc)(db_1.schema.chaslayHomepageBuilders.updatedAt)],
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
    static async get(merchantId, id) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            await this.ensureHomepageRepaired(merchantId);
            const db = (0, db_1.getDb)();
            const row = await db.query.chaslayHomepageBuilders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId)),
            });
            if (!row)
                throw new Error("Homepage builder not found");
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
    static async getActive(merchantId) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            await this.ensureBootstrappedFromLegacy(merchantId);
            await this.ensureHomepageRepaired(merchantId);
            const db = (0, db_1.getDb)();
            const row = await db.query.chaslayHomepageBuilders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.isActive, true)),
            });
            if (!row)
                return null;
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
    static async create(merchantId, input) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            const db = (0, db_1.getDb)();
            const initialState = editorStateForCreate(input.editor_state);
            const [row] = await db
                .insert(db_1.schema.chaslayHomepageBuilders)
                .values({
                merchantId,
                name: input.name,
                editorState: initialState.editorState,
                lastGoodEditorState: initialState.lastGoodEditorState,
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
    static async update(merchantId, id, input) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            const db = (0, db_1.getDb)();
            const existing = await db.query.chaslayHomepageBuilders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId)),
            });
            if (!existing)
                throw new Error("Homepage builder not found");
            const patch = {
                updatedAt: new Date(),
            };
            if (input.name !== undefined)
                patch.name = input.name;
            if (input.editor_state !== undefined) {
                Object.assign(patch, (0, chaslay_editor_state_1.buildEditorStateWritePatch)(existing.editorState, existing.lastGoodEditorState, input.editor_state, DEFAULT_EMPTY_CANVAS_STATE));
            }
            const [row] = await db
                .update(db_1.schema.chaslayHomepageBuilders)
                .set(patch)
                .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, id))
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
    static async remove(merchantId, id) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            const db = (0, db_1.getDb)();
            const deleted = await db
                .delete(db_1.schema.chaslayHomepageBuilders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId)))
                .returning({ id: db_1.schema.chaslayHomepageBuilders.id });
            if (!deleted.length)
                throw new Error("Homepage builder not found");
        });
    }
    static async activate(merchantId, id) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            const db = (0, db_1.getDb)();
            const existing = await db.query.chaslayHomepageBuilders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId)),
            });
            if (!existing)
                throw new Error("Homepage builder not found");
            const homepagePage = await db.query.chaslayHomepageBuilderPages.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.isHomepage, true)),
                columns: { editorState: true, lastGoodEditorState: true },
            });
            (0, chaslay_editor_state_1.assertPublishableHomepage)(homepagePage?.editorState ?? null, existing.editorState, homepagePage?.lastGoodEditorState ?? null, existing.lastGoodEditorState);
            await db
                .update(db_1.schema.chaslayHomepageBuilders)
                .set({ isActive: false, updatedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId), (0, drizzle_orm_1.ne)(db_1.schema.chaslayHomepageBuilders.id, id)));
            const [row] = await db
                .update(db_1.schema.chaslayHomepageBuilders)
                .set({ isActive: true, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, id))
                .returning();
            const publishedState = await this.resolvePublishedEditorState(row.id, row.editorState);
            if (publishedState &&
                publishedState !== row.editorState &&
                !(0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(publishedState)) {
                await this.syncHomepagePageToBuilder(row.id, publishedState, row.lastGoodEditorState);
            }
            await db
                .update(db_1.schema.merchants)
                .set({ cmsHomepageEnabled: true, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            return { id: row.id, name: row.name, is_active: true };
        });
    }
    static async deactivate(merchantId, id) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            const db = (0, db_1.getDb)();
            const [row] = await db
                .update(db_1.schema.chaslayHomepageBuilders)
                .set({ isActive: false, updatedAt: new Date() })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId)))
                .returning();
            if (!row)
                throw new Error("Homepage builder not found");
            const otherActive = await db.query.chaslayHomepageBuilders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.isActive, true)),
                columns: { id: true },
            });
            if (!otherActive) {
                await db
                    .update(db_1.schema.merchants)
                    .set({ cmsHomepageEnabled: false, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            }
            return { id: row.id, name: row.name, is_active: false };
        });
    }
    static async listPages(merchantId, builderId) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            await this.ensureHomepageRepaired(merchantId);
            const db = (0, db_1.getDb)();
            const builder = await db.query.chaslayHomepageBuilders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, builderId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId)),
                columns: { id: true, editorState: true, lastGoodEditorState: true },
            });
            if (!builder)
                throw new Error("Homepage builder not found");
            const rows = await db.query.chaslayHomepageBuilderPages.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.chaslayHomepageBuilderPages.sortOrder)],
            });
            const pages = [];
            for (const p of rows) {
                let editor_state = p.editorState;
                if (p.isHomepage) {
                    const { resolved } = await (0, chaslay_homepage_heal_1.maybePersistHomepageSplitBrainHeal)(p.id, builder.id, p.editorState, builder.editorState, p.lastGoodEditorState, builder.lastGoodEditorState);
                    editor_state =
                        resolved ??
                            (0, chaslay_editor_state_1.pickPublishedEditorState)(p.editorState, builder.editorState, p.lastGoodEditorState, builder.lastGoodEditorState) ??
                            p.editorState;
                }
                pages.push({
                    id: p.id,
                    homepage_builder_id: p.homepageBuilderId,
                    title: p.title,
                    slug: p.slug,
                    editor_state,
                    is_homepage: p.isHomepage,
                    sort_order: p.sortOrder,
                });
            }
            return pages;
        });
    }
    static async createPage(merchantId, builderId, input) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            const db = (0, db_1.getDb)();
            await this.assertBuilder(merchantId, builderId);
            const slugExists = await db.query.chaslayHomepageBuilderPages.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.slug, input.slug)),
            });
            if (slugExists)
                throw new Error("A page with this slug already exists for this builder.");
            if (input.is_homepage) {
                await db
                    .update(db_1.schema.chaslayHomepageBuilderPages)
                    .set({ isHomepage: false })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId));
            }
            const initialState = editorStateForCreate(input.editor_state);
            const [row] = await db
                .insert(db_1.schema.chaslayHomepageBuilderPages)
                .values({
                homepageBuilderId: builderId,
                merchantId,
                title: input.title,
                slug: input.slug,
                editorState: initialState.editorState,
                lastGoodEditorState: initialState.lastGoodEditorState,
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
    static async updatePage(merchantId, builderId, pageId, input) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            const db = (0, db_1.getDb)();
            await this.assertBuilder(merchantId, builderId);
            const page = await db.query.chaslayHomepageBuilderPages.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.id, pageId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId)),
            });
            if (!page)
                throw new Error("Page not found");
            if (input.slug && input.slug !== page.slug) {
                const slugExists = await db.query.chaslayHomepageBuilderPages.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.slug, input.slug), (0, drizzle_orm_1.ne)(db_1.schema.chaslayHomepageBuilderPages.id, pageId)),
                });
                if (slugExists)
                    throw new Error("A page with this slug already exists for this builder.");
            }
            if (input.is_homepage) {
                await db
                    .update(db_1.schema.chaslayHomepageBuilderPages)
                    .set({ isHomepage: false })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId), (0, drizzle_orm_1.ne)(db_1.schema.chaslayHomepageBuilderPages.id, pageId)));
            }
            const patch = {
                updatedAt: new Date(),
            };
            if (input.title !== undefined)
                patch.title = input.title;
            if (input.slug !== undefined)
                patch.slug = input.slug;
            if (input.editor_state !== undefined) {
                Object.assign(patch, (0, chaslay_editor_state_1.buildEditorStateWritePatch)(page.editorState, page.lastGoodEditorState, input.editor_state, DEFAULT_EMPTY_CANVAS_STATE));
            }
            if (input.is_homepage !== undefined)
                patch.isHomepage = input.is_homepage;
            if (input.sort_order !== undefined)
                patch.sortOrder = input.sort_order;
            const [row] = await db
                .update(db_1.schema.chaslayHomepageBuilderPages)
                .set(patch)
                .where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.id, pageId))
                .returning();
            if (row.isHomepage && (input.editor_state !== undefined || input.is_homepage === true)) {
                await this.syncHomepagePageToBuilder(builderId, row.editorState, row.lastGoodEditorState);
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
    static async removePage(merchantId, builderId, pageId) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            const db = (0, db_1.getDb)();
            await this.assertBuilder(merchantId, builderId);
            const page = await db.query.chaslayHomepageBuilderPages.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.id, pageId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId)),
            });
            if (!page)
                throw new Error("Page not found");
            if (page.isHomepage)
                throw new Error("Cannot delete the homepage. Set another page as homepage first.");
            const count = await db.query.chaslayHomepageBuilderPages.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builderId),
                columns: { id: true },
            });
            if (count.length <= 1)
                throw new Error("Cannot delete the last remaining page.");
            await db.delete(db_1.schema.chaslayHomepageBuilderPages).where((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.id, pageId));
        });
    }
    static async assertBuilder(merchantId, builderId) {
        const db = (0, db_1.getDb)();
        const row = await db.query.chaslayHomepageBuilders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.id, builderId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId)),
            columns: { id: true },
        });
        if (!row)
            throw new Error("Homepage builder not found");
    }
    /** Published pages from the merchant's active builder layout (empty when none active). */
    static async listActivePublishedPages(merchantId) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            await this.ensureHomepageRepaired(merchantId);
            const db = (0, db_1.getDb)();
            const builder = await db.query.chaslayHomepageBuilders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.isActive, true)),
                columns: { id: true, name: true, updatedAt: true },
            });
            if (!builder)
                return [];
            const rows = await db.query.chaslayHomepageBuilderPages.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builder.id),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.chaslayHomepageBuilderPages.sortOrder)],
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
    static async getActivePublishedPage(merchantId, pageSlug) {
        return (0, ensure_merchant_schema_1.withMerchantSchemaRetry)(async () => {
            await this.ensureHomepageRepaired(merchantId);
            const db = (0, db_1.getDb)();
            const builder = await db.query.chaslayHomepageBuilders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilders.isActive, true)),
            });
            if (!builder)
                return null;
            const normalizedSlug = pageSlug === "home" ? null : pageSlug;
            const page = normalizedSlug
                ? await db.query.chaslayHomepageBuilderPages.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builder.id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.slug, normalizedSlug)),
                })
                : await db.query.chaslayHomepageBuilderPages.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.homepageBuilderId, builder.id), (0, drizzle_orm_1.eq)(db_1.schema.chaslayHomepageBuilderPages.isHomepage, true)),
                });
            if (!page)
                return null;
            const editor_state = (0, chaslay_editor_state_1.pickPublishedEditorState)(page.editorState, builder.editorState, page.lastGoodEditorState, builder.lastGoodEditorState);
            if (!editor_state || (0, chaslay_editor_state_1.isEffectivelyEmptyEditorState)(editor_state))
                return null;
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
exports.ChaslayPagebuilderService = ChaslayPagebuilderService;
//# sourceMappingURL=chaslay-pagebuilder.service.js.map