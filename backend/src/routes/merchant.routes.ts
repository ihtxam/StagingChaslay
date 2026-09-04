import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  verifyToken,
  requireMerchant,
  setMerchantContext,
  requirePermission,
} from "@/middleware/auth.middleware";
import { requireRetailModule } from "@/middleware/business-module.middleware";
import { normalizeCatalogVisibility } from "@/lib/catalog-visibility";
import { ProductService } from "@/services/product.service";
import { CategoryService } from "@/services/category.service";
import { isValidHexColor, normalizeHexColor } from "@/lib/category-colors";
import { OrderService } from "@/services/order.service";
import { CustomerService } from "@/services/customer.service";
import { MerchantSettingsService } from "@/services/merchant-settings.service";
import { CatalogImportService, type ImportProgressEvent } from "@/services/catalog-import.service";
import { DemoCatalogService } from "@/services/demo-catalog.service";
import { ModifierService } from "@/services/modifier.service";
import { normalizeComboSlots } from "@/lib/combo";
import { roundMoney2 } from "@/lib/money";
import { geocodeQuery } from "@/lib/geocode";
import { isAllowedImageMime, saveMerchantImage } from "@/services/media-upload.service";
import { getDb, schema } from "@/db";
import { SubscriptionBillingService } from "@/services/subscription-billing.service";
import { SubscriptionPlansService } from "@/services/subscription-plans.service";
import posSessionsRoutes from "@/routes/pos-sessions.routes";
import locationsRoutes from "@/routes/locations.routes";
import hqRoutes from "@/routes/hq.routes";
import clientErrorsRoutes from "@/routes/client-errors.routes";
import { setLocationContext } from "@/middleware/location.middleware";
import type { ReportPreset } from "@/services/pos-reports.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImageMime(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
  },
});

const POS_SAFE_SETTINGS_KEYS = new Set([
  "posColorTheme",
  "panelLanguage",
  "acceptingOrders",
  "acceptingReservations",
  "reservationsEnabled",
]);

/** Staff can use POS/catalog APIs; writes to catalog/settings/billing stay permission-gated. */
function restrictStaffMerchantWrites(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === "merchant") return next();
  if (req.user?.role !== "staff") return next();

  const method = req.method.toUpperCase();
  const path = req.path || "";

  if (method === "PUT" && (path === "/settings" || path === "/settings/")) {
    const keys = Object.keys((req.body || {}) as Record<string, unknown>);
    if (keys.length && keys.every((k) => POS_SAFE_SETTINGS_KEYS.has(k))) return next();
    return requirePermission("MANAGE_SETTINGS")(req, res, next);
  }

  if (path.startsWith("/billing")) {
    return requirePermission("MANAGE_BILLING")(req, res, next);
  }

  const catalogWrite =
    /^(POST|PUT|PATCH|DELETE)$/.test(method) &&
    (/^\/products(\/|$)/.test(path) ||
      /^\/categories(\/|$)/.test(path) ||
      /^\/modifiers(\/|$)/.test(path) ||
      path === "/demo-menu-photos" ||
      path === "/media");
  if (catalogWrite) {
    return requirePermission("MANAGE_PRODUCTS")(req, res, next);
  }

  return next();
}

// Apply merchant middleware to all routes
router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);
router.use(setLocationContext);
router.use(restrictStaffMerchantWrites);

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================

/**
 * GET /api/merchant/products/import/template
 * Download Excel template for one-click import
 */
router.get("/products/import/template", async (_req: Request, res: Response) => {
  try {
    const buffer = CatalogImportService.buildTemplateBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="reborn-catalog-template.xlsx"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to build template" });
  }
});

/**
 * GET /api/merchant/products/export
 * Download Excel export of categories + products
 */
router.get("/products/export", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const buffer = await CatalogImportService.exportWorkbook(merchantId);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="chaslayreborn-catalog-export.xlsx"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to export catalog" });
  }
});

/**
 * POST /api/merchant/products/barcodes/generate
 * Assign numeric-only barcodes (12-digit 20 + 10 internal series) to products missing a barcode.
 * Never overwrites existing EAN/UPC or other barcodes. Optional useSku only if SKU is 8–12 digits.
 */
router.post("/products/barcodes/generate", requireRetailModule, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { BarcodeService } = await import("@/services/barcode.service");
    const result = await BarcodeService.generateMissing(merchantId, {
      productIds: Array.isArray(req.body?.productIds) ? req.body.productIds : undefined,
      useSku: req.body?.useSku === true,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error generating barcodes:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to generate barcodes",
    });
  }
});

/**
 * POST /api/merchant/products/photos/import-missing
 * Assign royalty-free food photos (Foodish API) to products without an image.
 */
router.post("/products/photos/import-missing", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { ProductPhotoImportService } = await import("@/services/product-photo-import.service");
    const result = await ProductPhotoImportService.importMissing(merchantId, {
      productIds: Array.isArray(req.body?.productIds) ? req.body.productIds : undefined,
      limit: Number(req.body?.limit) || 50,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Product photo import failed:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to import product photos",
    });
  }
});

/**
 * POST /api/merchant/products/import
 * One-click Excel import for categories + products
 */
router.post("/products/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    if (!req.file?.buffer) return res.status(400).json({ error: "Excel file is required (field: file)" });

    const result = await CatalogImportService.importWorkbook(merchantId, req.file.buffer);
    res.json({ success: result.success, ...result });
  } catch (error) {
    console.error("Import failed:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Import failed" });
  }
});

/**
 * POST /api/merchant/products/import/stream
 * Excel import with Server-Sent Events progress updates.
 */
router.post("/products/import/stream", upload.single("file"), async (req: Request, res: Response) => {
  const merchantId = req.merchantId;
  if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
  if (!req.file?.buffer) return res.status(400).json({ error: "Excel file is required (field: file)" });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload: ImportProgressEvent & { result?: Record<string, unknown> }) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const result = await CatalogImportService.importWorkbook(merchantId, req.file.buffer, {
      onProgress: (event) => send(event),
    });
    send({ phase: "done", message: "Import complete", percent: 100, result: { success: result.success, ...result } });
    res.end();
  } catch (error) {
    console.error("Import stream failed:", error);
    send({
      phase: "error",
      message: error instanceof Error ? error.message : "Import failed",
    });
    res.end();
  }
});

/**
 * POST /api/merchant/products/import-demo
 * Seed café/bistro demo catalog (categories, products, modifiers, combos).
 */
router.post(
  "/products/import-demo",
  requirePermission("MANAGE_PRODUCTS"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

      const mode = req.body?.mode;
      const force = req.body?.force === true;
      const result = await DemoCatalogService.importDemo(merchantId, {
        mode: mode === "replace" || mode === "merge" ? mode : undefined,
        force,
      });
      res.json(result);
    } catch (error) {
      console.error("Demo catalog import failed:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Demo import failed" });
    }
  }
);

/**
 * GET /api/merchant/products/demo-status
 * Whether demo catalog products are present.
 */
router.get(
  "/products/demo-status",
  requirePermission("MANAGE_PRODUCTS"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const hasDemoData = await DemoCatalogService.hasDemoData(merchantId);
      res.json({ success: true, hasDemoData });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to check demo status" });
    }
  }
);

/**
 * DELETE /api/merchant/products/demo-data
 * Remove imported demo catalog products/categories only (clientId demo-* prefix).
 */
router.delete(
  "/products/demo-data",
  requirePermission("MANAGE_PRODUCTS"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const result = await DemoCatalogService.deleteDemo(merchantId);
      res.json(result);
    } catch (error) {
      console.error("Demo catalog delete failed:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete demo catalog" });
    }
  }
);

/**
 * GET /api/merchant/products
 * Get all products
 */
router.get("/products", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const page = parseInt(req.query.page as string) || 1;
    const requestedLimit = parseInt(req.query.limit as string) || 100;
    const limit = Math.min(Math.max(requestedLimit, 1), 5000);
    const search = req.query.search as string;
    const categoryId = req.query.categoryId as string;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const [products, total, productLimit] = await Promise.all([
      ProductService.getProducts(merchantId, page, limit, search, categoryId),
      ProductService.countProducts(merchantId, search, categoryId),
      (async () => {
        try {
          const { ProductEntitlementsService } = await import("@/services/product-entitlements.service");
          return await ProductEntitlementsService.getLimitInfo(merchantId);
        } catch (err) {
          console.warn("Product limit lookup failed:", err);
          return null;
        }
      })(),
    ]);
    const pageList = products || [];

    // Resolve combo option products that may not be on the current page
    const optionIds = new Set<string>();
    for (const p of pageList as any[]) {
      if (p.productType !== "combo") continue;
      for (const slot of normalizeComboSlots(p.comboItems)) {
        for (const o of slot.options) optionIds.add(o.productId);
      }
    }
    const pageIds = new Set(pageList.map((p: { id: string }) => p.id));
    const missingIds = [...optionIds].filter((id) => !pageIds.has(id));
    let optionProducts: any[] = [];
    if (missingIds.length) {
      const db = getDb();
      optionProducts = await db.query.products.findMany({
        where: and(
          eq(schema.products.merchantId, merchantId),
          inArray(schema.products.id, missingIds)
        ),
      });
    }

    const catalogById = new Map<string, any>();
    for (const p of [...pageList, ...optionProducts]) catalogById.set(p.id, p);
    const groupsByProduct = await ModifierService.getGroupsForProducts(
      merchantId,
      [...catalogById.keys()]
    );

    const withCatalog = pageList.map((p: any) => {
      const modifierGroups = groupsByProduct.get(p.id) || [];
      const extras = Array.isArray(p.extras) ? p.extras : [];
      const isCombo = p.productType === "combo";
      const comboSlots = isCombo
        ? normalizeComboSlots(p.comboItems)
            .map((slot) => ({
              id: slot.id,
              name: slot.name,
              minPick: slot.minPick,
              maxPick: slot.maxPick,
              options: slot.options
                .map((opt) => {
                  const child = catalogById.get(opt.productId);
                  if (!child || child.isActive === false) return null;
                  const childGroups = groupsByProduct.get(child.id) || [];
                  const childExtras = Array.isArray(child.extras) ? child.extras : [];
                  return {
                    productId: child.id,
                    name: child.name,
                    image: child.imageUrl,
                    description: child.description,
                    extraPrice: roundMoney2(opt.extraPrice),
                    allowExtras:
                      !!child.allowExtras || childGroups.length > 0 || childExtras.length > 0,
                    extras: childExtras.map((e: any) => ({
                      id: e.id,
                      name: e.name,
                      price: Number(e.price) || 0,
                    })),
                    modifierGroups: childGroups,
                  };
                })
                .filter(Boolean),
            }))
            .filter((s) => s.options.length > 0)
        : [];

      return {
        ...p,
        modifierGroups,
        allowExtras: !!p.allowExtras || modifierGroups.length > 0 || extras.length > 0,
        comboSlots,
      };
    });

    res.json({
      success: true,
      products: withCatalog,
      pagination: { page, limit, total },
      productLimit: productLimit
        ? {
            maxProducts: productLimit.maxProducts,
            currentCount: productLimit.currentCount,
            planSlug: productLimit.planSlug,
            planName: productLimit.planName,
          }
        : null,
    });
  } catch (error) {
    console.error("Error getting products:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get products" });
  }
});

/**
 * PUT /api/merchant/products/reorder
 * Persist product list order
 */
router.put("/products/reorder", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderedIds } = req.body as { orderedIds?: string[] };

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const products = await ProductService.reorderProducts(merchantId, orderedIds || []);

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Error reordering products:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reorder products" });
  }
});

/**
 * GET /api/merchant/products/:productId
 * Get product details
 */
router.get("/products/:productId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { productId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const product = await ProductService.getProductById(merchantId, productId);
    const modifierGroups = await ModifierService.getGroupsForProduct(merchantId, productId);

    res.json({
      success: true,
      product: { ...product, modifierGroups },
    });
  } catch (error) {
    console.error("Error getting product:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Product not found" });
  }
});

/**
 * POST /api/merchant/products
 * Create product
 */
router.post("/products", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const {
      name,
      price,
      categoryId,
      sku,
      barcode,
      cost,
      stock,
      isTaxable,
      description,
      imageUrl,
      productType,
      isOpenPrice,
      soldByWeight,
      weightUnit,
      bulkPricing,
      extras,
      comboItems,
      allowExtras,
      clientId,
      specifications,
      buttonColor,
      loyaltyRewardPoints,
      modifierGroupIds,
      visibility,
    } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!name || price === undefined) {
      return res.status(400).json({ error: "Name and price are required" });
    }
    if (!categoryId) {
      return res.status(400).json({ error: "Category is required" });
    }
    if (sku != null && String(sku).length > 100) {
      return res.status(400).json({ error: "SKU must be at most 100 characters" });
    }
    const stockNum = stock == null || stock === "" ? 0 : Number(stock);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      return res.status(400).json({ error: "Stock cannot be negative" });
    }
    const priceDigits = String(price).replace(/[^\d]/g, "");
    if (priceDigits.length > 10) {
      return res.status(400).json({ error: "Price must be at most 10 digits" });
    }

    const { ProductEntitlementsService } = await import("@/services/product-entitlements.service");
    try {
      await ProductEntitlementsService.assertCanAddProducts(merchantId, 1);
    } catch (error) {
      const err = error as Error & { statusCode?: number; code?: string; limit?: unknown };
      if (err.code === "PRODUCT_LIMIT_REACHED") {
        return res.status(err.statusCode || 403).json({
          error: err.message,
          code: err.code,
          productLimit: err.limit,
        });
      }
      throw error;
    }

    let normalizedLoyaltyReward: number | null | undefined = undefined;
    if (loyaltyRewardPoints === null || loyaltyRewardPoints === "" || loyaltyRewardPoints === undefined) {
      normalizedLoyaltyReward = loyaltyRewardPoints === undefined ? undefined : null;
    } else {
      const rawPts = String(loyaltyRewardPoints).trim();
      const ptsDigits = rawPts.replace(/[^\d]/g, "");
      if (ptsDigits.length > 10) {
        return res.status(400).json({ error: "Free points must be at most 10 digits" });
      }
      const n = Math.floor(Number(ptsDigits || rawPts));
      if (!Number.isFinite(n) || n < 1 || n > 2147483647) {
        return res
          .status(400)
          .json({ error: "Free points must be a whole number between 1 and 2147483647" });
      }
      normalizedLoyaltyReward = n;
    }

    const { sanitizeComboSlotsInput } = await import("@/lib/combo");
    const normalizedComboItems =
      productType === "combo" || (Array.isArray(comboItems) && comboItems.length)
        ? sanitizeComboSlotsInput(comboItems)
        : comboItems || [];

    const product = await ProductService.createProduct(
      merchantId,
      name,
      price,
      categoryId,
      sku,
      barcode,
      cost,
      Math.floor(stockNum),
      isTaxable !== false,
      description,
      imageUrl,
      {
        productType: productType === "combo" || normalizedComboItems.length ? "combo" : productType,
        isOpenPrice,
        soldByWeight,
        weightUnit,
        bulkPricing,
        extras,
        comboItems: normalizedComboItems,
        allowExtras,
        clientId,
        specifications,
        buttonColor,
        loyaltyRewardPoints: normalizedLoyaltyReward === undefined ? null : normalizedLoyaltyReward,
      }
    );

    let modifierGroups: unknown[] = [];
    if (Array.isArray(modifierGroupIds) && modifierGroupIds.length) {
      modifierGroups = await ModifierService.setGroupsForProduct(
        merchantId,
        product.id,
        modifierGroupIds
      );
    }

    if (visibility !== undefined) {
      await ProductService.updateProduct(merchantId, product.id, {
        visibility: normalizeCatalogVisibility(visibility),
      });
    }

    const saved = await ProductService.getProductById(merchantId, product.id);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: { ...saved, modifierGroups },
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create product" });
  }
});

/**
 * PUT /api/merchant/products/:productId
 * Update product
 */
router.put("/products/:productId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { productId } = req.params;
    const { modifierGroupIds, ...updates } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    // Coerce numeric fields commonly sent as numbers from the dashboard
    if (updates.price !== undefined) {
      const priceDigits = String(updates.price).replace(/[^\d]/g, "");
      if (priceDigits.length > 10) {
        return res.status(400).json({ error: "Price must be at most 10 digits" });
      }
      updates.price = String(updates.price);
    }
    if (updates.cost !== undefined && updates.cost !== null) updates.cost = String(updates.cost);
    if (updates.categoryId !== undefined && !updates.categoryId) {
      return res.status(400).json({ error: "Category is required" });
    }
    if (updates.sku != null && String(updates.sku).length > 100) {
      return res.status(400).json({ error: "SKU must be at most 100 characters" });
    }
    if (updates.stock !== undefined) {
      const stockNum = Number(updates.stock);
      if (!Number.isFinite(stockNum) || stockNum < 0) {
        return res.status(400).json({ error: "Stock cannot be negative" });
      }
      updates.stock = Math.floor(stockNum);
    }

    if (updates.loyaltyRewardPoints !== undefined) {
      if (updates.loyaltyRewardPoints === null || updates.loyaltyRewardPoints === "") {
        updates.loyaltyRewardPoints = null;
      } else {
        const rawPts = String(updates.loyaltyRewardPoints).trim();
        const ptsDigits = rawPts.replace(/[^\d]/g, "");
        if (ptsDigits.length > 10) {
          return res.status(400).json({ error: "Free points must be at most 10 digits" });
        }
        const n = Math.floor(Number(ptsDigits || rawPts));
        if (!Number.isFinite(n) || n < 1 || n > 2147483647) {
          return res
            .status(400)
            .json({ error: "Free points must be a whole number between 1 and 2147483647" });
        }
        updates.loyaltyRewardPoints = n;
      }
    }

    if (updates.comboItems !== undefined || updates.productType === "combo") {
      const { sanitizeComboSlotsInput } = await import("@/lib/combo");
      updates.comboItems = sanitizeComboSlotsInput(updates.comboItems || []);
      if (updates.productType === "combo" || (updates.comboItems as unknown[]).length) {
        updates.productType = "combo";
      }
    }

    if (updates.visibility !== undefined) {
      updates.visibility = normalizeCatalogVisibility(updates.visibility);
    }

    const product = await ProductService.updateProduct(merchantId, productId, updates);

    let modifierGroups = undefined;
    if (Array.isArray(modifierGroupIds)) {
      modifierGroups = await ModifierService.setGroupsForProduct(
        merchantId,
        productId,
        modifierGroupIds
      );
    } else {
      modifierGroups = await ModifierService.getGroupsForProduct(merchantId, productId);
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      product: { ...product, modifierGroups },
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update product" });
  }
});

/**
 * DELETE /api/merchant/products/:productId
 * Delete product
 */
router.delete("/products/:productId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { productId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    await ProductService.deleteProduct(merchantId, productId);

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete product" });
  }
});

/**
 * PUT /api/merchant/products/:productId/stock
 * Update product stock
 */
router.put("/products/:productId/stock", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (quantity === undefined) {
      return res.status(400).json({ error: "Quantity is required" });
    }

    const product = await ProductService.updateStock(merchantId, productId, quantity);

    res.json({
      success: true,
      message: "Stock updated successfully",
      product,
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update stock" });
  }
});

/**
 * GET /api/merchant/products/low-stock
 * Get low stock products
 */
router.get("/products/low-stock", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const products = await ProductService.getLowStockProducts(merchantId);

    res.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Error getting low stock products:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get products" });
  }
});

/**
 * GET /api/merchant/products/statistics
 * Get product statistics
 */
router.get("/products/statistics", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const stats = await ProductService.getProductStatistics(merchantId);

    res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("Error getting product statistics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get statistics" });
  }
});

// ============================================================================
// MODIFIER GROUPS (extras / add-ons)
// ============================================================================

/**
 * GET /api/merchant/modifiers
 */
router.get("/modifiers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const groups = await ModifierService.list(merchantId);
    res.json({ success: true, groups });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list modifiers" });
  }
});

/**
 * GET /api/merchant/modifiers/:groupId
 */
router.get("/modifiers/:groupId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const group = await ModifierService.getById(merchantId, req.params.groupId);
    res.json({ success: true, group });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Not found" });
  }
});

/**
 * POST /api/merchant/modifiers
 */
router.post("/modifiers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const group = await ModifierService.create(merchantId, req.body);
    res.status(201).json({ success: true, group });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create group" });
  }
});

/**
 * PUT /api/merchant/modifiers/:groupId
 */
router.put("/modifiers/:groupId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const group = await ModifierService.update(merchantId, req.params.groupId, req.body);
    res.json({ success: true, group });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update group" });
  }
});

/**
 * DELETE /api/merchant/modifiers/:groupId
 */
router.delete("/modifiers/:groupId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    await ModifierService.remove(merchantId, req.params.groupId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete group" });
  }
});

/**
 * PUT /api/merchant/products/:productId/modifiers
 * Set linked modifier groups for a product
 */
router.put("/products/:productId/modifiers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const groupIds = Array.isArray(req.body.groupIds) ? req.body.groupIds : [];
    const groups = await ModifierService.setGroupsForProduct(
      merchantId,
      req.params.productId,
      groupIds
    );
    res.json({ success: true, modifierGroups: groups });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to link modifiers" });
  }
});

// ============================================================================
// CATEGORY MANAGEMENT
// ============================================================================

/**
 * GET /api/merchant/categories
 * Get all categories
 */
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const categories = await CategoryService.getCategories(merchantId);

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get categories" });
  }
});

/**
 * PUT /api/merchant/categories/reorder
 * Persist category list order
 */
router.put("/categories/reorder", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderedIds } = req.body as { orderedIds?: string[] };

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const categories = await CategoryService.reorderCategories(merchantId, orderedIds || []);

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Error reordering categories:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to reorder categories",
    });
  }
});

/**
 * POST /api/merchant/categories
 * Create category
 */
router.post("/categories", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { name, description, color, visibility } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedDescription =
      typeof description === "string" ? description.trim() : description;
    if (!name || (typeof name === "string" && !name.trim())) {
      return res.status(400).json({
        error: !String(name || "").length
          ? "Category name is required"
          : "Category name cannot be only spaces",
      });
    }
    if (trimmedName.length > 56) {
      return res.status(400).json({ error: "Category name must be 56 characters or fewer" });
    }
    if (typeof trimmedDescription === "string" && trimmedDescription.length > 256) {
      return res.status(400).json({ error: "Description must be 256 characters or fewer" });
    }
    if (color != null && color !== "" && !isValidHexColor(String(color))) {
      return res.status(400).json({ error: "Invalid category color" });
    }
    const normalizedColor =
      color != null && color !== "" ? normalizeHexColor(String(color)) : color;

    const category = await CategoryService.createCategory(
      merchantId,
      trimmedName,
      trimmedDescription,
      normalizedColor
    );

    if (visibility !== undefined) {
      await CategoryService.updateCategory(merchantId, category.id, {
        visibility: normalizeCatalogVisibility(visibility),
      });
    }
    const saved =
      visibility !== undefined
        ? (await CategoryService.getCategories(merchantId)).find((c) => c.id === category.id) ||
          category
        : category;

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category: saved,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create category" });
  }
});

/**
 * PUT /api/merchant/categories/:categoryId
 * Update category
 */
router.put("/categories/:categoryId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { categoryId } = req.params;
    const updates = { ...req.body };

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (typeof updates.name === "string") {
      const trimmedName = updates.name.trim();
      if (!updates.name.length) {
        return res.status(400).json({ error: "Category name is required" });
      }
      if (!trimmedName) {
        return res.status(400).json({ error: "Category name cannot be only spaces" });
      }
      if (trimmedName.length > 56) {
        return res.status(400).json({ error: "Category name must be 56 characters or fewer" });
      }
      updates.name = trimmedName;
    }
    if (typeof updates.description === "string") {
      const trimmedDescription = updates.description.trim();
      if (trimmedDescription.length > 256) {
        return res.status(400).json({ error: "Description must be 256 characters or fewer" });
      }
      updates.description = trimmedDescription;
    }
    if (updates.color !== undefined) {
      if (updates.color == null || updates.color === "") {
        delete updates.color;
      } else if (!isValidHexColor(String(updates.color))) {
        return res.status(400).json({ error: "Invalid category color" });
      } else {
        updates.color = normalizeHexColor(String(updates.color));
      }
    }

    if (updates.visibility !== undefined) {
      updates.visibility = normalizeCatalogVisibility(updates.visibility);
    }
    if (updates.deliveryPricingEnabled !== undefined) {
      updates.deliveryPricingEnabled = !!updates.deliveryPricingEnabled;
    }
    if (updates.extraDeliveryPrice !== undefined) {
      const n = Number(updates.extraDeliveryPrice);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: "extraDeliveryPrice must be >= 0" });
      }
      updates.extraDeliveryPrice = n.toFixed(2);
    }

    const category = await CategoryService.updateCategory(merchantId, categoryId, updates);

    res.json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update category" });
  }
});

/**
 * DELETE /api/merchant/categories/:categoryId
 * Delete category
 */
router.delete("/categories/:categoryId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { categoryId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    await CategoryService.deleteCategory(merchantId, categoryId);

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete category" });
  }
});

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

/**
 * GET /api/merchant/orders
 * Get all orders
 */
router.get("/orders", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status =
      (req.query.statuses as string) ||
      (req.query.status as string) ||
      undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const scopeRaw = String(req.query.scope || "").toLowerCase();
    const scope = scopeRaw === "online" || scopeRaw === "incoming" ? "online" : "all";

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const orders = await OrderService.getOrders(
      merchantId,
      page,
      limit,
      status,
      startDate,
      endDate,
      scope
    );

    res.json({
      success: true,
      orders,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting orders:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get orders" });
  }
});

/**
 * GET /api/merchant/orders/incoming
 * Active online / QR / kiosk orders for Order Hub and Web POS polling.
 */
router.get("/orders/incoming", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const limit = req.query.limit ? Number(req.query.limit) : 200;
    const statuses =
      (req.query.statuses as string) || (req.query.status as string) || undefined;
    const since = req.query.since ? new Date(String(req.query.since)) : undefined;

    const orders = await OrderService.getIncomingOrders(merchantId, {
      limit,
      statuses,
      since: since && !Number.isNaN(since.getTime()) ? since : undefined,
    });

    res.json({
      success: true,
      orders,
      pagination: { limit: Math.min(Math.max(limit, 1), 300) },
    });
  } catch (error) {
    console.error("Error getting incoming orders:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get incoming orders",
    });
  }
});

/**
 * GET /api/merchant/orders/:orderId
 * Get order details
 */
router.get("/orders/:orderId", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const order = await OrderService.getOrderById(merchantId, orderId);

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Error getting order:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Order not found" });
  }
});

/**
 * POST /api/merchant/orders
 * Create order
 */
router.post("/orders", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { items, customerId, orderType, paymentMethod, discountAmount, notes } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Order items are required" });
    }

    const order = await OrderService.createOrder(
      merchantId,
      items,
      customerId,
      orderType || "pos",
      paymentMethod,
      discountAmount || 0,
      notes,
      req.locationId || req.body?.locationId
    );

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order" });
  }
});

/**
 * PUT /api/merchant/orders/:orderId/status
 * Update order status
 */
router.put("/orders/:orderId/status", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId } = req.params;
    const { status } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const order = await OrderService.updateOrderStatus(merchantId, orderId, status);

    res.json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update order" });
  }
});

/**
 * GET /api/merchant/invoices — unpaid + paid invoice orders (all dates)
 * GET /api/merchant/orders/:orderId/invoice.pdf
 * POST /api/merchant/orders/:orderId/record-invoice-payment
 */
router.get("/invoices", async (req: Request, res: Response) => {
  const { merchantListInvoices } = await import("@/routes/invoice.routes");
  return merchantListInvoices(req, res);
});

router.get("/orders/:orderId/invoice.pdf", async (req: Request, res: Response) => {
  const { merchantInvoicePdf } = await import("@/routes/invoice.routes");
  return merchantInvoicePdf(req, res);
});

router.post("/orders/:orderId/record-invoice-payment", async (req: Request, res: Response) => {
  const { merchantRecordInvoicePayment } = await import("@/routes/invoice.routes");
  return merchantRecordInvoicePayment(req, res);
});

router.post("/orders/:orderId/email-invoice", async (req: Request, res: Response) => {
  const { merchantEmailInvoice } = await import("@/routes/invoice.routes");
  return merchantEmailInvoice(req, res);
});

/**
 * POST /api/merchant/orders/:orderId/action
 * Lifecycle action: accept | start_preparing | mark_ready | out_for_delivery |
 * collect_payment | complete | complete_and_collect | reject
 */
router.post("/orders/:orderId/action", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId } = req.params;
    const {
      action,
      paymentMethod,
      rejectReason,
      estimatedReadyAt,
      etaAdjustMinutes,
      skipReceiptPrint,
    } = req.body as {
      action?: string;
      paymentMethod?: string;
      rejectReason?: string;
      estimatedReadyAt?: string;
      etaAdjustMinutes?: number;
      skipReceiptPrint?: boolean;
    };

    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    if (!action) return res.status(400).json({ error: "Action is required" });

    const order = await OrderService.applyOrderAction(merchantId, orderId, action, {
      paymentMethod: paymentMethod || null,
      rejectReason: rejectReason || null,
      estimatedReadyAt: estimatedReadyAt || null,
      etaAdjustMinutes: etaAdjustMinutes ?? null,
      skipReceiptPrint: skipReceiptPrint === true,
    });
    res.json({ success: true, order });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Action failed" });
  }
});

/**
 * POST /api/merchant/orders/:orderId/cancel
 * Cancel order
 */
router.post("/orders/:orderId/cancel", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { orderId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const order = await OrderService.cancelOrder(merchantId, orderId);

    res.json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to cancel order" });
  }
});

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * GET /api/merchant/customers
 * Get all customers
 */
router.get("/customers", requirePermission("MANAGE_CUSTOMERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const customers = await CustomerService.getCustomers(merchantId, page, limit, search);

    res.json({
      success: true,
      customers,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting customers:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get customers" });
  }
});

/**
 * POST /api/merchant/customers
 * Create customer
 */
router.post("/customers", requirePermission("MANAGE_CUSTOMERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { email, phone, firstName, lastName, defaultAddress, defaultZip, defaultCity, name } =
      req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    let first = typeof firstName === "string" ? firstName.trim() : firstName;
    let last = typeof lastName === "string" ? lastName.trim() : lastName;
    const mail = typeof email === "string" ? email.trim() : email;
    const tel = typeof phone === "string" ? phone.trim() : phone;
    if (!first && !last && name) {
      const parts = String(name).trim().split(/\s+/).filter(Boolean);
      first = parts[0] || "";
      last = parts.slice(1).join(" ") || "";
    }
    if (!tel && !mail && !first && !last) {
      return res.status(400).json({ error: "Name, email, or phone is required (spaces only are not allowed)" });
    }
    if (tel != null && String(tel).length > 0) {
      const digits = String(tel).replace(/\D/g, "");
      if (!/^\d{1,15}$/.test(digits) || digits !== String(tel)) {
        return res.status(400).json({ error: "Phone number must be digits only (max 15)" });
      }
    }

    const customer = await CustomerService.createCustomer(merchantId, mail, tel, first, last, {
      defaultAddress,
      defaultZip,
      defaultCity,
    });

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create customer" });
  }
});

/**
 * GET /api/merchant/customers/:customerId
 * Get customer details
 */
router.get("/customers/:customerId", requirePermission("MANAGE_CUSTOMERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { customerId } = req.params;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const customer = await CustomerService.getCustomerById(merchantId, customerId);

    res.json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("Error getting customer:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Customer not found" });
  }
});

/**
 * GET /api/merchant/me
 * Current merchant identity + paid addon flags (inventory).
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }
    const settings = await MerchantSettingsService.getMerchantSettings(merchantId);
    const inventoryOn = settings.inventoryAddonEnabled === true;
    res.json({
      success: true,
      merchant: {
        id: settings.id,
        email: settings.email,
        name: settings.name,
        shopEnabled: settings.shopEnabled,
        inventoryAddonEnabled: inventoryOn,
        inventoryEnabled: inventoryOn,
        signageAddonEnabled: settings.signageAddonEnabled === true,
        signageEnabled: settings.signageAddonEnabled === true,
        signageScreenLimit: settings.signageScreenLimit ?? 2,
        editionFeatures: settings.editionFeatures,
        hasPos: settings.hasPos,
        showOrderCenter: settings.showOrderCenter,
        showDeliveryHub: settings.showDeliveryHub,
        orderCenterEnabled: settings.orderCenterEnabled,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load merchant",
    });
  }
});

/**
 * GET /api/merchant/settings
 * Get merchant settings
 */
router.get("/settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const settings = await MerchantSettingsService.getMerchantSettings(merchantId);

    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    const { dbErrorChain, formatDbMigrateError, migrateLogTag } = await import(
      "@/lib/db-schema-errors"
    );
    const raw = dbErrorChain(error) || "Failed to get settings";
    const tag = migrateLogTag(raw);
    if (tag) {
      console.error(`[settings] schema missing (${tag}):`, raw);
    } else {
      console.error("Error getting settings:", error);
    }
    res.status(500).json({
      error: formatDbMigrateError(raw, "Failed to get settings"),
    });
  }
});

/**
 * GET /api/merchant/bestsellers
 * Top product ids by quantity sold (for POS "Most Sold" category).
 */
router.get("/bestsellers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const { PosReportsService } = await import("@/services/pos-reports.service");
    const productIds = await PosReportsService.getBestsellerProductIds(merchantId, {
      limit,
      days,
    });
    res.json({ success: true, productIds });
  } catch (error) {
    console.error("Error getting bestsellers:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get bestsellers",
    });
  }
});

/**
 * GET /api/merchant/webpos-config
 * Payment methods + terminals for WebPOS checkout
 */
router.get("/webpos-config", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    const terminals = await db.query.paymentTerminals.findMany({
      where: eq(schema.paymentTerminals.merchantId, merchantId),
      orderBy: asc(schema.paymentTerminals.createdAt),
    });

    const activeTerminals = terminals.filter((t) => t.status === "active");
    const terminalReady =
      !!merchant.adyenApiKey &&
      !!merchant.adyenMerchantAccount &&
      activeTerminals.length > 0;
    const tapToPayReady =
      merchant.tapToPayEnabled === true &&
      !!merchant.adyenApiKey &&
      !!merchant.adyenMerchantAccount;

    const { normalizePosPrintSettings } = await import("@/lib/pos-print-settings");
    const { normalizePosCheckoutSettings } = await import("@/lib/pos-checkout-settings");
    const { normalizeGiftCardSettings } = await import("@/lib/gift-card-settings");
    const posPrintSettings = normalizePosPrintSettings(merchant.posPrintSettings);
    const posCheckoutSettings = normalizePosCheckoutSettings(merchant.posCheckoutSettings);
    const giftCardSettings = normalizeGiftCardSettings(merchant.giftCardSettings);

    const { WebPosEntitlementService } = await import("@/services/webpos-entitlement.service");
    const entitlement = await WebPosEntitlementService.getEntitlement(merchantId);

    let staffPreferredTerminalId: string | null = null;
    const clockedStaffId = req.user?.staffId;
    if (clockedStaffId) {
      const staffRow = await db.query.merchantStaff.findFirst({
        where: and(
          eq(schema.merchantStaff.id, clockedStaffId),
          eq(schema.merchantStaff.merchantId, merchantId)
        ),
      });
      const pref = staffRow?.preferredTerminalId?.trim() || null;
      if (pref && activeTerminals.some((t) => t.terminalId === pref)) {
        staffPreferredTerminalId = pref;
      }
    }

    res.json({
      success: true,
      config: {
        methods: {
          // Express checkout bar under products — driven by posCheckoutSettings, not a tender.
          express: posCheckoutSettings.expressCheckoutEnabled,
          cash: merchant.webposCashEnabled !== false,
          card: merchant.webposCardEnabled !== false,
          terminal: merchant.webposTerminalEnabled !== false && terminalReady,
          tap_to_pay: tapToPayReady,
          giftCard: merchant.webposGiftCardEnabled === true && giftCardSettings.enabled,
          invoice: (merchant as { webposInvoiceEnabled?: boolean }).webposInvoiceEnabled !== false,
        },
        giftCardSettings,
        loyalty: (await import("@/services/shop-loyalty.service")).ShopLoyaltyService.programFromMerchant(
          merchant
        ),
        terminalReady,
        tapToPayReady,
        adyenConfigured: !!merchant.adyenApiKey && !!merchant.adyenMerchantAccount,
        tapToPayEnabled: merchant.tapToPayEnabled === true,
        adyenLiveEnvironment: !!merchant.adyenLiveEnvironment,
        adyenLiveRegion: merchant.adyenLiveRegion || "EU",
        adyenUseLegacyEndpoint: !!merchant.adyenUseLegacyEndpoint,
        defaultTerminalId: activeTerminals[0]?.terminalId || null,
        staffPreferredTerminalId,
        terminals: terminals.map((t) => ({
          id: t.id,
          terminalId: t.terminalId,
          terminalName: t.terminalName,
          status: t.status,
        })),
        posPrintSettings,
        posCheckoutSettings: {
          ...posCheckoutSettings,
          vatIncludedInPrice: merchant.taxIncludedInPrice === true,
          vatAfterDiscount: merchant.vatAfterDiscount !== false,
        },
        taxIncludedInPrice: merchant.taxIncludedInPrice === true,
        vatAfterDiscount: merchant.vatAfterDiscount !== false,
        shopLogoUrl: merchant.shopLogoUrl || null,
        panelLanguage: merchant.panelLanguage || "en",
        // Coerce so WebPOS never hides shifts due to unexpected truthy shapes.
        shiftsEnabled: !!(merchant as { shiftsEnabled?: boolean | null }).shiftsEnabled,
        posColorTheme: merchant.posColorTheme || "teal",
        coursesEnabled: merchant.coursesEnabled === true,
        editionId: (merchant as { editionId?: string | null }).editionId || null,
        editionFeatures: await (async () => {
          try {
            const { EditionEntitlementsService } = await import(
              "@/services/edition-entitlements.service"
            );
            return await EditionEntitlementsService.getFeatures(merchantId);
          } catch {
            return null;
          }
        })(),
        entitlement,
      },
    });
  } catch (error) {
    console.error("Error getting webpos config:", error);
    const raw = error instanceof Error ? error.message : "Failed to get POS config";
    const needsShiftMigrate =
      /shifts_enabled|pos_color_theme|pos_shifts/i.test(raw) &&
      /does not exist|column|relation/i.test(raw);
    // Keep WebPOS usable; client falls back to /merchant/settings for shiftsEnabled.
    if (needsShiftMigrate) {
      return res.json({
        success: true,
        config: {
          methods: { express: true, cash: true, card: true, terminal: false, giftCard: false },
          shiftsEnabled: false,
          shiftsSchemaMissing: true,
          posColorTheme: "teal",
        },
      });
    }
    res.status(500).json({ error: raw });
  }
});

/**
 * GET /api/merchant/webpos-entitlement
 * Merchant-level 7-day trial / subscription status for WebPOS gating.
 */
router.get("/webpos-entitlement", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }
    const { WebPosEntitlementService } = await import("@/services/webpos-entitlement.service");
    const entitlement = await WebPosEntitlementService.getEntitlement(merchantId);
    res.json({ success: true, entitlement });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to check POS entitlement",
    });
  }
});

/**
 * GET /api/merchant/pos/shifts/current
 * Open shift + live cash totals (WebPOS)
 */
router.get("/pos/shifts/current", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosShiftService } = await import("@/services/pos-shift.service");
    const data = await PosShiftService.getCurrent(merchantId);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error("Error getting current shift:", error);
    const raw = error instanceof Error ? error.message : "Failed to get shift";
    const needsMigrate = /pos_shifts/i.test(raw) && /does not exist|relation/i.test(raw);
    res.status(500).json({
      error: needsMigrate
        ? "Database is missing pos_shifts. Run backend/sql/ensure-shifts.sql (or drizzle-kit push)."
        : raw,
    });
  }
});

/**
 * POST /api/merchant/pos/shifts/start
 * Body: { openingCash, staffId?, staffName? }
 */
router.post("/pos/shifts/start", async (req: Request, res: Response) => {
  const merchantId = req.merchantId;
  if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
  try {
    const { WebPosEntitlementService } = await import("@/services/webpos-entitlement.service");
    if (!(await WebPosEntitlementService.guard(merchantId, res))) return;
    const { PosShiftService } = await import("@/services/pos-shift.service");
    const rawOpen = req.body?.openingCash;
    const openingCash =
      rawOpen === "" || rawOpen === null || rawOpen === undefined ? 0 : Number(rawOpen);
    const shift = await PosShiftService.startShift(merchantId, {
      openingCash: Number.isFinite(openingCash) ? openingCash : 0,
      staffId: req.body?.staffId || null,
      staffName: req.body?.staffName || null,
    });
    res.json({ success: true, shift });
  } catch (error) {
    console.error("Error starting shift:", error);
    const msg = error instanceof Error ? error.message : "Failed to start shift";
    if (/already open/i.test(msg)) {
      const { PosShiftService } = await import("@/services/pos-shift.service");
      const data = await PosShiftService.getCurrent(merchantId);
      return res.status(409).json({ error: msg, success: false, ...data });
    }
    res.status(400).json({ error: msg });
  }
});

/**
 * POST /api/merchant/pos/shifts/close
 * Body: { closingCashCounted, notes? }
 */
router.post("/pos/shifts/close", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosShiftService } = await import("@/services/pos-shift.service");
    const result = await PosShiftService.closeShift(merchantId, {
      closingCashCounted: Number(req.body?.closingCashCounted ?? 0),
      notes: req.body?.notes || null,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error closing shift:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to close shift" });
  }
});

/**
 * POST /api/merchant/pos/shifts/cash-movement
 * Body: { type: 'in'|'out', amount, reason?, staffId?, staffName? }
 */
router.post("/pos/shifts/cash-movement", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosShiftService } = await import("@/services/pos-shift.service");
    const type = String(req.body?.type || "").toLowerCase();
    if (type !== "in" && type !== "out") {
      return res.status(400).json({ error: "type must be 'in' or 'out'" });
    }
    const result = await PosShiftService.recordCashMovement(merchantId, {
      type,
      amount: Number(req.body?.amount ?? 0),
      reason: req.body?.reason || null,
      staffId: req.body?.staffId || null,
      staffName: req.body?.staffName || null,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error recording cash movement:", error);
    const raw = error instanceof Error ? error.message : "Failed to record cash movement";
    const needsMigrate = /pos_cash_movements/i.test(raw) && /does not exist|relation/i.test(raw);
    res.status(400).json({
      error: needsMigrate
        ? "Database is missing pos_cash_movements. Run backend/sql/ensure-cash-movements.sql (or drizzle-kit push)."
        : raw,
    });
  }
});

/**
 * GET /api/merchant/pos/shifts/cash-movements?shiftId=
 */
router.get("/pos/shifts/cash-movements", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const shiftId = String(req.query.shiftId || "");
    if (!shiftId) return res.status(400).json({ error: "shiftId is required" });
    const { PosShiftService } = await import("@/services/pos-shift.service");
    const movements = await PosShiftService.listCashMovements(merchantId, shiftId);
    res.json({ success: true, movements });
  } catch (error) {
    console.error("Error listing cash movements:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list cash movements",
    });
  }
});

/**
 * PUT /api/merchant/settings
 * Update merchant settings
 */
router.put("/settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const updates = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const merchant = await MerchantSettingsService.updateMerchantSettings(merchantId, updates);

    res.json({
      success: true,
      message: "Settings updated successfully",
      merchant,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Failed to update settings";
    const { formatDbMigrateError, migrateLogTag } = await import("@/lib/db-schema-errors");
    const tag = migrateLogTag(raw);
    if (tag) {
      console.error(`[settings] schema missing on save (${tag}):`, raw);
    } else {
      console.error("Error updating settings:", error);
    }
    res.status(400).json({
      error: formatDbMigrateError(raw, "Failed to update settings"),
    });
  }
});

/**
 * GET /api/merchant/reports/eod
 * End-of-day / sales report (POS + synced sales in orders table)
 * Query: preset=today|yesterday|last_week|last_month|last_3_months|custom&from=&to=
 * Requires VIEW_REPORTS or END_OF_DAY.
 * Company-wide totals need VIEW_ALL_SALES; otherwise scoped to PIN staff (own sales).
 */
router.get(
  "/reports/eod",
  requirePermission("VIEW_REPORTS", "END_OF_DAY"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const { resolveReportActor, salesScopeForActor } = await import(
        "@/lib/report-sales-scope"
      );
      const actor = resolveReportActor(req);
      // PIN session on an owner JWT: still require report permission on the PIN role.
      if (actor.kind === "pin") {
        const ok =
          actor.permissions.includes("VIEW_REPORTS") ||
          actor.permissions.includes("END_OF_DAY");
        if (!ok) {
          return res.status(403).json({ error: "Permission denied" });
        }
      }
      const scope = salesScopeForActor(actor);
      if (!scope.viewAll && !scope.staffId) {
        return res.status(403).json({
          error: "Own-sales reports require a staff PIN session",
        });
      }
      let staffId: string | null = scope.staffId ?? null;
      let staffName: string | null = scope.staffName ?? null;
      if (scope.viewAll && req.query.staffId) {
        staffId = String(req.query.staffId);
        staffName = req.query.staffName ? String(req.query.staffName) : null;
      }
      const { PosReportsService } = await import("@/services/pos-reports.service");
      const preset = String(req.query.preset || "today") as
        | "today"
        | "yesterday"
        | "last_week"
        | "this_month"
        | "last_month"
        | "last_3_months"
        | "custom";
      const report = await PosReportsService.getEndOfDayReport(merchantId, {
        preset,
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
        channel: req.query.channel ? String(req.query.channel) : undefined,
        staffId,
        staffName,
        locationId:
          req.query.scope === "location"
            ? (req.locationId as string | undefined) || undefined
            : req.query.locationId
              ? String(req.query.locationId)
              : undefined,
      });
      res.json({ success: true, report });
    } catch (error) {
      console.error("EOD report failed:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load report" });
    }
  }
);

/**
 * GET /api/merchant/reports/shift
 * Shift-scoped sales report (exact from/to ISO timestamps from shift open/close).
 * Query: from=&to= (ISO). Scoped to PIN staff when VIEW_ALL_SALES is absent.
 */
router.get("/reports/shift", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const from = req.query.from ? String(req.query.from) : "";
    const to = req.query.to ? String(req.query.to) : "";
    if (!from || !to) {
      return res.status(400).json({ error: "from and to (ISO timestamps) are required" });
    }
    const { resolveReportActor, salesScopeForActor } = await import(
      "@/lib/report-sales-scope"
    );
    const actor = resolveReportActor(req);
    const scope = salesScopeForActor(actor);
    if (!scope.viewAll && !scope.staffId) {
      return res.status(403).json({
        error: "Own-sales shift reports require a staff PIN session",
      });
    }
    const { PosReportsService } = await import("@/services/pos-reports.service");
    const report = await PosReportsService.getShiftReport(merchantId, {
      from,
      to,
      staffId: scope.staffId,
      staffName: scope.staffName,
    });
    res.json({ success: true, report });
  } catch (error) {
    console.error("Shift report failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load report" });
  }
});

/**
 * GET /api/merchant/reports/overview
 * OrderPin-style merchant overview dashboard (KPIs, charts, breakdowns).
 */
router.get(
  "/reports/overview",
  requirePermission("VIEW_REPORTS", "END_OF_DAY"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const { resolveReportActor, salesScopeForActor } = await import(
        "@/lib/report-sales-scope"
      );
      const actor = resolveReportActor(req);
      if (actor.kind === "pin") {
        const ok =
          actor.permissions.includes("VIEW_REPORTS") ||
          actor.permissions.includes("END_OF_DAY");
        if (!ok) {
          return res.status(403).json({ error: "Permission denied" });
        }
      }
      const scope = salesScopeForActor(actor);
      if (!scope.viewAll && !scope.staffId) {
        return res.status(403).json({
          error: "Own-sales reports require a staff PIN session",
        });
      }
      const { PosReportsService } = await import("@/services/pos-reports.service");
      const preset = String(req.query.preset || "today") as
        | "today"
        | "yesterday"
        | "last_week"
        | "this_month"
        | "last_month"
        | "last_3_months"
        | "custom";
      const overview = await PosReportsService.getOverviewDashboard(merchantId, {
        preset,
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
        staffId: scope.staffId,
        staffName: scope.staffName,
        locationId:
          req.query.scope === "location"
            ? (req.locationId as string | undefined) || undefined
            : req.query.locationId
              ? String(req.query.locationId)
              : undefined,
      });
      res.json({ success: true, overview });
    } catch (error) {
      console.error("Overview report failed:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load overview",
      });
    }
  }
);

/**
 * GET /api/merchant/reports/revenue?mode=days|weeks|months&year=2026&month=6
 * SumUp-style revenue breakdown by day, calendar week, or month.
 */
router.get(
  "/reports/revenue",
  requirePermission("VIEW_REPORTS", "END_OF_DAY"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const { resolveReportActor, salesScopeForActor } = await import(
        "@/lib/report-sales-scope"
      );
      const actor = resolveReportActor(req);
      if (actor.kind === "pin") {
        const ok =
          actor.permissions.includes("VIEW_REPORTS") ||
          actor.permissions.includes("END_OF_DAY");
        if (!ok) {
          return res.status(403).json({ error: "Permission denied" });
        }
      }
      const scope = salesScopeForActor(actor);
      if (!scope.viewAll && !scope.staffId) {
        return res.status(403).json({
          error: "Own-sales reports require a staff PIN session",
        });
      }
      const mode = String(req.query.mode || "days").toLowerCase();
      if (mode !== "days" && mode !== "weeks" && mode !== "months" && mode !== "custom") {
        return res.status(400).json({ error: "mode must be days, weeks, months, or custom" });
      }
      const year = Number(req.query.year) || new Date().getFullYear();
      const month = req.query.month != null ? Number(req.query.month) : undefined;
      const from = req.query.from ? String(req.query.from) : undefined;
      const to = req.query.to ? String(req.query.to) : undefined;
      const { PosReportsService } = await import("@/services/pos-reports.service");
      const breakdown = await PosReportsService.getRevenueBreakdown(merchantId, {
        mode: mode as "days" | "weeks" | "months" | "custom",
        year,
        month,
        from,
        to,
        staffId: scope.staffId,
        staffName: scope.staffName,
      });
      res.json({ success: true, breakdown });
    } catch (error) {
      console.error("Revenue breakdown failed:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load revenue",
      });
    }
  }
);

/**
 * GET /api/merchant/reports/export?format=xlsx|csv&preset=...
 * Download overview/EOD workbook (OrderPin-inspired columns).
 */
router.get(
  "/reports/export",
  requirePermission("VIEW_REPORTS", "END_OF_DAY"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const { resolveReportActor, salesScopeForActor } = await import(
        "@/lib/report-sales-scope"
      );
      const actor = resolveReportActor(req);
      if (actor.kind === "pin") {
        const ok =
          actor.permissions.includes("VIEW_REPORTS") ||
          actor.permissions.includes("END_OF_DAY");
        if (!ok) {
          return res.status(403).json({ error: "Permission denied" });
        }
      }
      const scope = salesScopeForActor(actor);
      if (!scope.viewAll && !scope.staffId) {
        return res.status(403).json({
          error: "Own-sales reports require a staff PIN session",
        });
      }
      const { ReportExportService } = await import("@/services/report-export.service");
      const preset = String(req.query.preset || "today") as
        | "today"
        | "yesterday"
        | "last_week"
        | "this_month"
        | "last_month"
        | "last_3_months"
        | "custom";
      const format = String(req.query.format || "xlsx").toLowerCase();
      const rawLang = String(req.query.language || req.query.lang || "en").slice(0, 2).toLowerCase();
      const language = rawLang === "fr" || rawLang === "de" ? rawLang : "en";
      const opts = {
        preset,
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
        staffId: scope.staffId,
        staffName: scope.staffName,
        language,
      };
      const file =
        format === "csv"
          ? await ReportExportService.buildOverviewCsv(merchantId, opts)
          : await ReportExportService.buildOverviewWorkbook(merchantId, opts);
      res.setHeader("Content-Type", file.mime);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.filename.replace(/"/g, "")}"`
      );
      res.send(file.buffer);
    } catch (error) {
      console.error("Report export failed:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to export report",
      });
    }
  }
);

/** GET/PUT report email settings + POST send */
router.get(
  "/reports/email-settings",
  requirePermission("VIEW_REPORTS", "END_OF_DAY"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const { ReportEmailService } = await import("@/services/report-email.service");
      const settings = await ReportEmailService.getSettings(merchantId);
      res.json({ success: true, settings });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Failed to load settings";
      const needsMigrate =
        /report_email_settings/i.test(raw) && /does not exist|column/i.test(raw);
      res.status(needsMigrate ? 400 : 500).json({
        error: needsMigrate
          ? "Database is missing report_email_settings. Run backend/sql/ensure-report-email-settings.sql"
          : raw,
      });
    }
  }
);

router.put(
  "/reports/email-settings",
  requirePermission("VIEW_REPORTS", "END_OF_DAY"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const { ReportEmailService } = await import("@/services/report-email.service");
      const body = req.body || {};
      const settings = await ReportEmailService.saveSettings(merchantId, {
        language: body.language,
        sendEveryDay: body.sendEveryDay,
        sendEveryMonth: body.sendEveryMonth,
        emails: body.emails,
      });
      res.json({ success: true, settings });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Failed to save settings";
      const needsMigrate =
        /report_email_settings/i.test(raw) && /does not exist|column/i.test(raw);
      res.status(400).json({
        error: needsMigrate
          ? "Database is missing report_email_settings. Run backend/sql/ensure-report-email-settings.sql"
          : raw,
      });
    }
  }
);

router.post(
  "/reports/email-send",
  requirePermission("VIEW_REPORTS", "END_OF_DAY"),
  async (req: Request, res: Response) => {
    try {
      const merchantId = req.merchantId;
      if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
      const { ReportEmailService } = await import("@/services/report-email.service");
      const body = req.body || {};
      const result = await ReportEmailService.sendReportEmail(merchantId, {
        preset: body.preset || "today",
        from: body.from,
        to: body.to,
        emails: body.emails,
        language: body.language,
        kind: "manual",
      });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Report email send failed:", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to send report email",
      });
    }
  }
);

/**
 * POST /api/merchant/pos/send-receipt-email
 * Email a digital receipt link (and optional plain-text receipt) via merchant SMTP / Brevo.
 */
router.post("/pos/send-receipt-email", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    const to = String(req.body?.email || req.body?.to || "").trim();
    if (!to.includes("@")) {
      return res.status(400).json({ error: "Valid email required" });
    }

    const rawReceiptUrl = String(req.body?.receiptUrl || "").trim();
    const { normalizeReceiptPublicUrl } = await import("@/lib/receipt-public-url");
    const receiptUrl = rawReceiptUrl
      ? normalizeReceiptPublicUrl(rawReceiptUrl, String(req.body?.orderId || req.body?.clientId || "").trim() || undefined)
      : "";
    const receiptText = String(req.body?.receiptText || "").trim();
    const orderNumber = String(req.body?.orderNumber || "").trim();
    const amount =
      req.body?.amount != null && Number.isFinite(Number(req.body.amount))
        ? Number(req.body.amount)
        : null;

    if (!receiptUrl && !receiptText) {
      return res.status(400).json({ error: "receiptUrl or receiptText is required" });
    }

    const merchant = await getDb().query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { name: true },
    });
    const shopName = merchant?.name || "Shop";
    const subjectBits = [
      shopName,
      orderNumber ? `#${orderNumber}` : null,
      "Receipt",
    ].filter(Boolean);
    const subject = subjectBits.join(" · ");

    const amountLine =
      amount != null
        ? `<p style="font-size:18px;font-weight:700;margin:12px 0;">CHF ${amount.toFixed(2)}</p>`
        : "";
    const linkBlock = receiptUrl
      ? `<p><a href="${receiptUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View receipt</a></p>
         <p style="color:#666;font-size:12px;word-break:break-all;">${receiptUrl}</p>`
      : "";
    const textBlock = receiptText
      ? `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;background:#f5f5f4;padding:12px;border-radius:8px;">${receiptText
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</pre>`
      : "";

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;">
        <h2 style="margin:0 0 8px;">${shopName}</h2>
        <p style="margin:0;color:#57534e;">Your receipt${orderNumber ? ` for order ${orderNumber}` : ""}</p>
        ${amountLine}
        ${linkBlock}
        ${textBlock}
      </div>
    `;
    const text =
      `${shopName}\nYour receipt${orderNumber ? ` for order ${orderNumber}` : ""}\n` +
      (amount != null ? `CHF ${amount.toFixed(2)}\n` : "") +
      (receiptUrl ? `${receiptUrl}\n` : "") +
      (receiptText ? `\n${receiptText}\n` : "");

    const { EmailService } = await import("@/services/email.service");
    await EmailService.send({
      merchantId,
      to,
      subject,
      html,
      text,
      emailType: "receipt",
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Send receipt email failed:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to send receipt email",
    });
  }
});

/** POST /api/merchant/pos/print-jobs — queue ESC/POS for the main till (Print Agent hub) */
router.post("/pos/print-jobs", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { jobType, payload, sourceDeviceId, orderId } = req.body ?? {};
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "payload required" });
    }
    const { ChaslayFloorService } = await import("@/services/chaslay-floor.service");
    const data = await ChaslayFloorService.createPrintJob(merchantId, {
      jobType: jobType || "ESCPOS",
      payload,
      sourceDeviceId,
      orderId,
    });
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Print job create failed",
    });
  }
});

/** GET /api/merchant/pos/print-jobs/pending — main till polls ESC/POS jobs */
router.get("/pos/print-jobs/pending", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const jobType = req.query.jobType ? String(req.query.jobType) : "ESCPOS";
    const { ChaslayFloorService } = await import("@/services/chaslay-floor.service");
    const data = await ChaslayFloorService.listPendingPrintJobs(merchantId, limit, {
      jobTypes: [jobType],
    });
    const { PrintJobExpandService } = await import("@/services/print-job-expand.service");
    const jobs = [];
    for (const job of data.jobs || []) {
      const payload = await PrintJobExpandService.materializeRecipePayload(
        merchantId,
        (job.payload || {}) as Record<string, unknown>
      );
      if (payload && String(payload.kind) === "escpos" && payload.dataBase64) {
        await ChaslayFloorService.updatePrintJobPayload(
          merchantId,
          job.id,
          payload as Record<string, unknown>
        );
      }
      jobs.push({ ...job, payload });
    }
    res.json({ success: true, ...data, jobs });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Print jobs fetch failed",
    });
  }
});

router.post("/pos/print-jobs/:id/ack", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const status = req.body?.status === "FAILED" ? "FAILED" : "DONE";
    const { ChaslayFloorService } = await import("@/services/chaslay-floor.service");
    const data = await ChaslayFloorService.ackPrintJob(merchantId, req.params.id, status);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Ack failed" });
  }
});

/** POST /api/merchant/pos/print-jobs/clear — stop runaway reprints (marks PENDING/PROCESSING as FAILED) */
router.post("/pos/print-jobs/clear", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { ChaslayFloorService } = await import("@/services/chaslay-floor.service");
    const data = await ChaslayFloorService.failOpenPrintJobs(merchantId);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Clear print jobs failed",
    });
  }
});

/** GET /api/merchant/pos/orders — POS order history */
router.get("/pos/orders", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const { resolveReportRange } = await import("@/services/pos-reports.service");
    const preset = req.query.preset ? (String(req.query.preset) as ReportPreset) : undefined;
    let from = req.query.from ? String(req.query.from) : undefined;
    let to = req.query.to ? String(req.query.to) : undefined;
    if (preset) {
      const range = resolveReportRange(preset, from, to);
      from = range.from;
      to = range.to;
    }
    const orders = await PosOrdersService.listPosOrders(merchantId, {
      status: req.query.status ? String(req.query.status) : undefined,
      from,
      to,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      q: req.query.q ? String(req.query.q) : undefined,
    });
    res.json({
      success: true,
      orders,
      cancelReasons: PosOrdersService.cancelReasons(),
      refundReasons: PosOrdersService.refundReasons(),
    });
  } catch (error) {
    console.error("POS orders list failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list orders" });
  }
});

router.post("/pos/orders/:id/cancel", requirePermission("CANCEL_ORDERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const order = await PosOrdersService.cancelOrder(merchantId, req.params.id, String(req.body?.reason || ""));
    res.json({ success: true, order });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cancel failed" });
  }
});

router.patch("/pos/orders/:id/payment-method", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const order = await PosOrdersService.updatePaymentMethod(
      merchantId,
      req.params.id,
      String(req.body?.paymentMethod || "")
    );
    res.json({ success: true, order });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update payment method",
    });
  }
});

router.post("/pos/orders/:id/refund", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const body = req.body || {};
    const items = Array.isArray(body.items)
      ? body.items.map((it: any) => ({
          orderItemId: String(it.orderItemId || it.id || ""),
          quantity: Number(it.quantity),
        }))
      : undefined;
    const result = await PosOrdersService.refundOrder(merchantId, req.params.id, {
      amount: body.amount != null ? Number(body.amount) : undefined,
      reason: body.reason != null ? String(body.reason) : undefined,
      fullTicket: body.fullTicket === true || body.mode === "full",
      items,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Refund failed" });
  }
});

/** Goodwill / unreferenced compensation (open amount, not capped by order total). */
router.post("/pos/orders/:id/goodwill", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const body = req.body || {};
    const result = await PosOrdersService.goodwillCompensation(merchantId, req.params.id, {
      amount: Number(body.amount),
      reason: String(body.reason || ""),
      method: body.method === "terminal" ? "terminal" : "cash",
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Goodwill compensation failed",
    });
  }
});

/** Preview monthly cash sales reduction (quantity adjustments, cash-only). */
router.get("/pos/sales-adjustment/preview", requirePermission("VIEW_ALL_SALES"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { SalesAdjustmentService } = await import("@/services/sales-adjustment.service");
    const percent = Number(req.query.percent);
    const preset = req.query.preset ? String(req.query.preset) : undefined;
    const from = req.query.from ? String(req.query.from) : undefined;
    const to = req.query.to ? String(req.query.to) : undefined;
    const month = req.query.month ? String(req.query.month) : undefined;
    const preview = await SalesAdjustmentService.preview(merchantId, percent, {
      preset,
      from,
      to,
      month,
    });
    res.json({ success: true, preview, allowedPercents: SalesAdjustmentService.allowedPercents() });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Sales adjustment preview failed",
    });
  }
});

/** Apply monthly cash sales reduction by lowering line quantities (no deletions). */
router.post("/pos/sales-adjustment/apply", requirePermission("VIEW_ALL_SALES"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { SalesAdjustmentService } = await import("@/services/sales-adjustment.service");
    const percent = Number(req.body?.percent);
    const preset = req.body?.preset ? String(req.body.preset) : undefined;
    const from = req.body?.from ? String(req.body.from) : undefined;
    const to = req.body?.to ? String(req.body.to) : undefined;
    const month = req.body?.month ? String(req.body.month) : undefined;
    const result = await SalesAdjustmentService.apply(merchantId, percent, {
      preset,
      from,
      to,
      month,
    });
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Sales adjustment failed",
    });
  }
});

/** POST /api/merchant/pos/orders/purge — permanently delete completed cash sales (gandola). */
router.post("/pos/orders/purge", requirePermission("GANDOLA_PURGE"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const raw = req.body?.orderIds;
    const orderIds = Array.isArray(raw) ? raw.map((id) => String(id)) : [];
    const { OrderPurgeService } = await import("@/services/order-purge.service");
    const result = await OrderPurgeService.purgeOrders(merchantId, orderIds);
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to delete orders",
    });
  }
});

/** Save clocked-in staff POS preferences (e.g. preferred payment terminal). */
router.put("/pos/staff-preferences", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const staffId = req.user?.staffId;
    if (!staffId) {
      return res.status(403).json({ error: "Clock in with your staff PIN to save preferences" });
    }
    const { StaffService } = await import("@/services/staff.service");
    const prefs = await StaffService.updatePosPreferences(merchantId, staffId, {
      preferredTerminalId: req.body?.preferredTerminalId ?? null,
    });
    res.json({ success: true, ...prefs });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save preferences",
    });
  }
});

router.get("/pos/held", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const held = await PosOrdersService.listHeld(merchantId);
    res.json({ success: true, held });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list held orders" });
  }
});

router.post("/pos/held", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { WebPosEntitlementService } = await import("@/services/webpos-entitlement.service");
    if (!(await WebPosEntitlementService.guard(merchantId, res))) return;
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const row = await PosOrdersService.holdOrder(merchantId, req.body || {});
    res.json({ success: true, held: row });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Hold failed" });
  }
});

/** Release held rows after payment — does not require CANCEL_ORDERS */
router.post("/pos/held/release", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { WebPosEntitlementService } = await import("@/services/webpos-entitlement.service");
    if (!(await WebPosEntitlementService.guard(merchantId, res))) return;
    const body = req.body || {};
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const result = await PosOrdersService.releaseHeldByIdentity(merchantId, {
      heldId: body.heldId ? String(body.heldId) : null,
      ticketDisplay: body.ticketDisplay != null ? String(body.ticketDisplay) : null,
      tableId: body.tableId != null ? String(body.tableId) : null,
      tabNumber: body.tabNumber != null ? String(body.tabNumber) : null,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Release failed" });
  }
});

router.post("/pos/held/:id/resume", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const row = await PosOrdersService.resumeHeld(merchantId, req.params.id);
    res.json({ success: true, held: row });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Resume failed" });
  }
});

router.delete("/pos/held/:id", requirePermission("CANCEL_ORDERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    await PosOrdersService.deleteHeld(merchantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Delete failed" });
  }
});

/** Cancel held / kitchen-sent order with reason — records cancellation for reports */
router.post("/pos/held/:id/cancel", requirePermission("CANCEL_ORDERS"), async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PosOrdersService } = await import("@/services/pos-orders.service");
    const result = await PosOrdersService.cancelHeld(
      merchantId,
      req.params.id,
      String(req.body?.reason || "")
    );
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cancel failed" });
  }
});

/**
 * POST /api/merchant/geocode
 * Body: { query?: string } — defaults to merchant address + city + country
 */
router.post("/geocode", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    let query = String(req.body?.query || "").trim();
    if (!query) {
      const settings = await MerchantSettingsService.getMerchantSettings(merchantId);
      query = [settings.address, settings.city, settings.country || "Switzerland"]
        .map((p) => String(p || "").trim())
        .filter(Boolean)
        .join(", ");
    }
    if (!query) {
      return res.status(400).json({ error: "No address to geocode. Set business address first." });
    }

    const result = await geocodeQuery(query);
    if (!result.found) {
      return res.json({ success: true, found: false, query });
    }
    res.json({
      success: true,
      found: true,
      query,
      lat: result.lat,
      lng: result.lng,
      displayName: result.displayName,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Geocode failed" });
  }
});

/**
 * POST /api/merchant/media
 * multipart field "file" — image upload (JPEG/PNG/WebP/GIF)
 */
router.post("/media", (req: Request, res: Response, next) => {
  imageUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Upload failed";
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    if (!req.file) return res.status(400).json({ error: "No image file uploaded" });

    const saved = await saveMerchantImage({
      merchantId,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    res.status(201).json({
      success: true,
      url: saved.url,
      mimeType: saved.mimeType,
      size: saved.size,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});

/**
 * POST /api/merchant/demo-menu-photos
 * Attach compressed demo images to products/categories missing photos.
 */
router.post("/demo-menu-photos", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    const fs = await import("fs");
    const path = await import("path");
    const demoDir = path.join(process.cwd(), "assets", "demo-menu");
    if (!fs.existsSync(demoDir)) {
      return res.status(404).json({ error: "Demo photos not packaged on server" });
    }

    const demoFiles = fs
      .readdirSync(demoDir)
      .filter((f) => /^demo-\d+\.jpg$/i.test(f))
      .sort();
    const catFiles = fs
      .readdirSync(demoDir)
      .filter((f) => /^cat-.+\.jpg$/i.test(f))
      .sort();
    if (!demoFiles.length) {
      return res.status(404).json({ error: "No demo product photos found" });
    }

    const db = getDb();
    const products = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
      orderBy: [asc(schema.products.sortOrder)],
    });
    const categories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
      orderBy: [asc(schema.categories.sortOrder)],
    });

    let productsUpdated = 0;
    let categoriesUpdated = 0;
    let i = 0;
    for (const p of products) {
      if (p.imageUrl) continue;
      const file = demoFiles[i % demoFiles.length];
      i += 1;
      const buf = fs.readFileSync(path.join(demoDir, file));
      const saved = await saveMerchantImage({
        merchantId,
        buffer: buf,
        mimeType: "image/jpeg",
        originalName: file,
      });
      await db
        .update(schema.products)
        .set({ imageUrl: saved.url, updatedAt: new Date() })
        .where(and(eq(schema.products.id, p.id), eq(schema.products.merchantId, merchantId)));
      productsUpdated += 1;
    }

    let ci = 0;
    for (const c of categories) {
      if ((c as { imageUrl?: string | null }).imageUrl) continue;
      const file = catFiles[ci % Math.max(catFiles.length, 1)] || demoFiles[ci % demoFiles.length];
      ci += 1;
      if (!file) continue;
      const buf = fs.readFileSync(path.join(demoDir, file));
      const saved = await saveMerchantImage({
        merchantId,
        buffer: buf,
        mimeType: "image/jpeg",
        originalName: file,
      });
      await db
        .update(schema.categories)
        .set({ imageUrl: saved.url, updatedAt: new Date() })
        .where(and(eq(schema.categories.id, c.id), eq(schema.categories.merchantId, merchantId)));
      categoriesUpdated += 1;
    }

    // Optional store banner if missing
    const merchant = await db.query.merchants.findFirst({ where: eq(schema.merchants.id, merchantId) });
    if (merchant && !merchant.shopBannerUrl && demoFiles[1]) {
      const buf = fs.readFileSync(path.join(demoDir, demoFiles[1]));
      const saved = await saveMerchantImage({
        merchantId,
        buffer: buf,
        mimeType: "image/jpeg",
        originalName: demoFiles[1],
      });
      await db
        .update(schema.merchants)
        .set({ shopBannerUrl: saved.url, updatedAt: new Date() })
        .where(eq(schema.merchants.id, merchantId));
    }

    res.json({ success: true, productsUpdated, categoriesUpdated });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to apply demo photos",
    });
  }
});

/**
 * GET /api/merchant/vat-settings
 * Get VAT settings
 */
router.get("/vat-settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const vatSettings = await MerchantSettingsService.getVATSettings(merchantId);

    res.json({
      success: true,
      vatSettings,
    });
  } catch (error) {
    console.error("Error getting VAT settings:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get VAT settings" });
  }
});

/**
 * POST /api/merchant/vat-settings
 * Create VAT setting
 */
router.post("/vat-settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    const { country, vatRate, taxId, isDefault } = req.body;

    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    if (!country || vatRate === undefined) {
      return res.status(400).json({ error: "Country and VAT rate are required" });
    }

    const vatSetting = await MerchantSettingsService.createVATSetting(
      merchantId,
      country,
      vatRate,
      taxId,
      isDefault
    );

    res.status(201).json({
      success: true,
      message: "VAT setting created successfully",
      vatSetting,
    });
  } catch (error) {
    console.error("Error creating VAT setting:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create VAT setting" });
  }
});

// ============================================================================
// BILLING / SUBSCRIPTION PLANS (payments → platform Adyen)
// ============================================================================

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlansService.listPublic();
    res.json({ success: true, plans });
  } catch (error) {
    console.error("Error listing plans:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list plans" });
  }
});

router.get("/entitlements", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { MerchantEntitlementsService } = await import(
      "@/services/merchant-entitlements.service"
    );
    const { ProductEntitlementsService } = await import(
      "@/services/product-entitlements.service"
    );
    const [limits, staff, devices, products] = await Promise.all([
      MerchantEntitlementsService.getLimits(merchantId).catch(() => null),
      MerchantEntitlementsService.getStaffLimitInfo(merchantId).catch(() => null),
      MerchantEntitlementsService.getDeviceLicenseLimitInfo(merchantId).catch(() => null),
      ProductEntitlementsService.getLimitInfo(merchantId).catch(() => null),
    ]);
    res.json({ success: true, limits, staff, devices, products });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load entitlements",
    });
  }
});

router.get("/billing", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const billing = await SubscriptionBillingService.getBillingOverview(merchantId);
    res.json({ success: true, ...billing });
  } catch (error) {
    console.error("Error getting billing:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get billing" });
  }
});

router.post("/billing/checkout", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { planId, billingCycle, returnUrl } = req.body || {};
    if (!planId) return res.status(400).json({ error: "planId is required" });

    const result = await SubscriptionBillingService.startCheckout(
      merchantId,
      planId,
      billingCycle === "yearly" ? "yearly" : "monthly",
      returnUrl
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error starting billing checkout:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to start checkout",
    });
  }
});

router.post("/billing/confirm", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { paymentId, resultCode, pspReference } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId is required" });

    const result = await SubscriptionBillingService.confirmPayment(merchantId, paymentId, {
      resultCode,
      pspReference,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error confirming billing payment:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to confirm payment",
    });
  }
});

router.post("/billing/addon/checkout", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { addonId, billingCycle, returnUrl } = req.body || {};
    if (!addonId) return res.status(400).json({ error: "addonId is required" });

    const result = await SubscriptionBillingService.startAddonCheckout(
      merchantId,
      addonId,
      billingCycle === "yearly" ? "yearly" : "monthly",
      returnUrl
    );
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error starting addon checkout:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to start add-on checkout",
    });
  }
});

router.post("/billing/addon/confirm", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { paymentId, resultCode, pspReference } = req.body || {};
    if (!paymentId) return res.status(400).json({ error: "paymentId is required" });

    const result = await SubscriptionBillingService.confirmAddonPayment(merchantId, paymentId, {
      resultCode,
      pspReference,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error confirming addon payment:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to confirm add-on payment",
    });
  }
});

// ============================================================================
// PLATFORM SHOP (buy supplies from Reborn)
// ============================================================================

router.get("/platform-shop/products", async (_req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const products = await PlatformShopService.listProducts(true);
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list products" });
  }
});

router.get("/platform-shop/orders", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const orders = await PlatformShopService.listMerchantOrders(merchantId);
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list orders" });
  }
});

router.post("/platform-shop/checkout", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const result = await PlatformShopService.startCheckout(merchantId, items, {
      notes: req.body?.notes,
      voucherCode: req.body?.voucherCode,
      returnUrl: req.body?.returnUrl,
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    console.error("Platform shop checkout failed:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Checkout failed",
    });
  }
});

router.post("/platform-shop/confirm", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const { orderId, resultCode, pspReference } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "orderId is required" });
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const result = await PlatformShopService.confirmPayment(merchantId, orderId, {
      resultCode,
      pspReference,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to confirm payment",
    });
  }
});

router.use(posSessionsRoutes);
router.use(locationsRoutes);
router.use(hqRoutes);
router.use("/client-errors", clientErrorsRoutes);

export default router;
