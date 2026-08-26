"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const cms_service_1 = require("@/services/cms.service");
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
/**
 * GET /api/merchant/cms/templates
 */
router.get("/templates", async (_req, res) => {
    res.json({ success: true, templates: cms_service_1.CmsService.listTemplates() });
});
/**
 * GET /api/merchant/cms/site
 */
router.get("/site", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            return res.status(404).json({ error: "Merchant not found" });
        res.json({
            success: true,
            site: {
                customDomain: merchant.customDomain || null,
                cmsHomepageEnabled: !!merchant.cmsHomepageEnabled,
                shopEnabled: !!merchant.shopEnabled,
                slug: merchant.slug,
                subdomain: merchant.subdomain,
                name: merchant.name,
                shopLogoUrl: merchant.shopLogoUrl,
                shopBannerUrl: merchant.shopBannerUrl,
                shopCustomDomainUrl: merchant.customDomain ? `https://${merchant.customDomain}` : null,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load site" });
    }
});
/**
 * PUT /api/merchant/cms/site
 */
router.put("/site", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const site = await cms_service_1.CmsService.updateSiteSettings(merchantId, {
            customDomain: req.body.customDomain,
            cmsHomepageEnabled: req.body.cmsHomepageEnabled,
        });
        res.json({ success: true, site });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update site" });
    }
});
/**
 * GET /api/merchant/cms/pages
 */
router.get("/pages", async (req, res) => {
    try {
        const pages = await cms_service_1.CmsService.listPages(req.merchantId);
        res.json({ success: true, pages });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list pages" });
    }
});
/**
 * POST /api/merchant/cms/pages
 */
router.post("/pages", async (req, res) => {
    try {
        const page = await cms_service_1.CmsService.createPage(req.merchantId, {
            title: req.body.title,
            slug: req.body.slug,
            isHomepage: req.body.isHomepage,
            templateKey: req.body.templateKey,
            blocks: req.body.blocks,
            seoTitle: req.body.seoTitle,
            seoDescription: req.body.seoDescription,
            status: req.body.status,
        });
        res.status(201).json({ success: true, page });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create page" });
    }
});
/**
 * GET /api/merchant/cms/pages/:pageId
 */
router.get("/pages/:pageId", async (req, res) => {
    try {
        const page = await cms_service_1.CmsService.getPage(req.merchantId, req.params.pageId);
        res.json({ success: true, page });
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "Page not found" });
    }
});
/**
 * PUT /api/merchant/cms/pages/:pageId
 */
router.put("/pages/:pageId", async (req, res) => {
    try {
        const page = await cms_service_1.CmsService.updatePage(req.merchantId, req.params.pageId, {
            title: req.body.title,
            slug: req.body.slug,
            isHomepage: req.body.isHomepage,
            blocks: req.body.blocks,
            theme: req.body.theme,
            seoTitle: req.body.seoTitle,
            seoDescription: req.body.seoDescription,
            status: req.body.status,
            templateKey: req.body.templateKey,
        });
        res.json({ success: true, page });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update page" });
    }
});
/**
 * DELETE /api/merchant/cms/pages/:pageId
 */
router.delete("/pages/:pageId", async (req, res) => {
    try {
        await cms_service_1.CmsService.deletePage(req.merchantId, req.params.pageId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete page" });
    }
});
/**
 * GET /api/merchant/cms/catalog — lightweight product/category list for homepage builder blocks
 */
router.get("/catalog", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const db = (0, db_1.getDb)();
        const [categories, products] = await Promise.all([
            db.query.categories.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.categories.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.categories.name)],
                columns: { id: true, name: true },
            }),
            db.query.products.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.products.name)],
                columns: {
                    id: true,
                    name: true,
                    categoryId: true,
                    price: true,
                    imageUrl: true,
                },
                limit: 5000,
            }),
        ]);
        res.json({
            success: true,
            categories,
            products: products.map((p) => ({
                id: p.id,
                name: p.name,
                categoryId: p.categoryId,
                price: p.price,
                image: p.imageUrl,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load catalog" });
    }
});
exports.default = router;
//# sourceMappingURL=cms.routes.js.map