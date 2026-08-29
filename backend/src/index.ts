import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "@/routes/auth.routes";
import licensingRoutes from "@/routes/licensing.routes";
import superadminRoutes from "@/routes/superadmin.routes";
import merchantRoutes from "@/routes/merchant.routes";
import paymentRoutes from "@/routes/payment.routes";
import webshopRoutes from "@/routes/webshop.routes";
import loyaltyRoutes from "@/routes/loyalty.routes";
import giftCardsRoutes from "@/routes/gift-cards.routes";
import syncRoutes from "@/routes/sync.routes";
import terminalsRoutes from "@/routes/terminals.routes";
import tapToPayRoutes from "@/routes/tap-to-pay.routes";
import shopRoutes from "@/routes/shop.routes";
import cmsRoutes from "@/routes/cms.routes";
import chaslayPagebuilderRoutes from "@/routes/chaslay-pagebuilder.routes";
import rfidReadersRoutes from "@/routes/rfid-readers.routes";
import deliveryZonesRoutes from "@/routes/delivery-zones.routes";
import floorPlansRoutes from "@/routes/floor-plans.routes";
import reservationsRoutes from "@/routes/reservations.routes";
import receiptsRoutes from "@/routes/receipts.routes";
import kdsRoutes, { kdsMerchantRoutes } from "@/routes/kds.routes";
import kioskRoutes, { kioskMerchantRouter } from "@/routes/kiosk.routes";
import odsRoutes, { odsMerchantRoutes } from "@/routes/ods.routes";
import signageRoutes, { signageMerchantRoutes } from "@/routes/signage.routes";
import chaslayRoutes from "@/routes/chaslay";
import webhooksRoutes from "@/routes/webhooks.routes";
import deliveryPlatformRoutes from "@/routes/delivery-platform.routes";
import offersRoutes from "@/routes/offers.routes";
import vouchersRoutes from "@/routes/vouchers.routes";
import marketingRoutes from "@/routes/marketing.routes";
import panelRoutes from "@/routes/panel.routes";
import merchantSupportRoutes from "@/routes/merchant-support.routes";
import resellerSupportRoutes from "@/routes/reseller-support.routes";
import inventoryRoutes from "@/routes/inventory.routes";
import storekeeperRoutes from "@/routes/storekeeper.routes";
import deliveryTrackingRoutes from "@/routes/delivery-tracking.routes";
import staffRoutes from "@/routes/staff.routes";
import resellerRoutes from "@/routes/reseller.routes";
import { ensureUploadsRoot } from "@/services/media-upload.service";
import { MarketingService } from "@/services/marketing.service";
import { ReservationService } from "@/services/reservation.service";
import { SubscriptionBillingService } from "@/services/subscription-billing.service";
import {
  ensureMerchantSchemaAtStartup,
  ensureAllMerchantSchema,
} from "@/lib/ensure-merchant-schema";
import { ensureLicensesSchemaAtStartup } from "@/lib/ensure-licenses-schema";
import { ensureSubscriptionSchemaAtStartup } from "@/lib/ensure-subscription-schema";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { APP_NAME, CURRENT_HOST_ALIASES, LEGACY_HOST_ALIASES } from "@/lib/brand";
import downloadsRoutes from "@/routes/downloads.routes";

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

function buildCorsOrigins(): string[] {
  const defaults = [
    process.env.SUPERADMIN_URL,
    process.env.MERCHANT_DASHBOARD_URL,
    process.env.WEB_SHOP_URL,
    process.env.PUBLIC_APP_URL,
    "http://localhost:5173",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    ...CURRENT_HOST_ALIASES,
    ...LEGACY_HOST_ALIASES,
  ].filter(Boolean) as string[];

  const extra = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...defaults, ...extra])];
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = buildCorsOrigins();
      // Allow mobile apps / same-origin / curl (no Origin header)
      if (!origin || allowed.includes(origin) || process.env.CORS_ALLOW_ALL === "true") {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      const url = req.originalUrl || req.url || "";
      if (/\/api\/webhooks\/(just-eat|uber-eats)/.test(url)) {
        (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Public uploaded media (vacation popup images, etc.)
const uploadsRoot = ensureUploadsRoot();
app.use(
  "/api/uploads",
  express.static(uploadsRoot, {
    fallthrough: false,
    maxAge: "7d",
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=604800");
    },
  })
);

// Public installers (print agent EXE, print bridge APK) — explicit routes avoid 500 JSON on missing files
app.use("/downloads", downloadsRoutes);

// ============================================================================
// ROUTES
// ============================================================================

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "reborn-backend",
    timestamp: new Date().toISOString(),
  });
});

/** Idempotent DB column repair — GET or POST (browser-safe). */
async function handleSchemaRepair(_req: Request, res: Response) {
  try {
    const result = await ensureAllMerchantSchema();
    const ok =
      result.missingAfter.length === 0 &&
      result.ordersMissing.length === 0 &&
      result.orderItemsMissing.length === 0 &&
      result.productsMissing.length === 0 &&
      result.editionsMissing.length === 0 &&
      result.subscriptionPlansMissing.length === 0 &&
      result.posSessionsMissing.length === 0;
    res.status(ok ? 200 : 500).json({
      status: ok ? "ok" : "error",
      repaired: true,
      missingBefore: result.missingBefore,
      missingAfter: result.missingAfter,
      ordersMissing: result.ordersMissing,
      orderItemsMissing: result.orderItemsMissing,
      productsMissing: result.productsMissing,
      editionsMissing: result.editionsMissing,
      subscriptionPlansMissing: result.subscriptionPlansMissing,
      posSessionsMissing: result.posSessionsMissing,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[schema-repair] failed:", error);
    res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Schema repair failed",
    });
  }
}
app.get("/health/schema-repair", handleSchemaRepair);
app.post("/health/schema-repair", handleSchemaRepair);
app.get("/api/health/schema-repair", handleSchemaRepair);
app.post("/api/health/schema-repair", handleSchemaRepair);

/** Public status page data (no auth). */
app.get("/api/public/status", async (_req: Request, res: Response) => {
  const components: Record<string, { status: "ok" | "error"; latencyMs?: number }> = {
    api: { status: "ok" },
    dashboard: { status: "ok" },
    shop: { status: "ok" },
    pay: { status: "ok" },
  };
  let overall: "operational" | "degraded" = "operational";

  try {
    const start = Date.now();
    await getDb().execute(sql`SELECT 1`);
    components.database = { status: "ok", latencyMs: Date.now() - start };
  } catch {
    components.database = { status: "error" };
    overall = "degraded";
  }

  res.json({
    status: overall,
    updatedAt: new Date().toISOString(),
    components,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/licensing", licensingRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/panel", panelRoutes);
app.use("/api/reseller", resellerRoutes);
app.use("/api/reseller/support", resellerSupportRoutes);
app.use("/api/merchant", merchantRoutes);
app.use("/api/merchant/support", merchantSupportRoutes);
app.use("/api/merchant", staffRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/webshop", webshopRoutes);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/gift-cards", giftCardsRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/terminals", terminalsRoutes);
app.use("/api/tap-to-pay", tapToPayRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/merchant/cms", cmsRoutes);
app.use("/api/merchant/chaslay-pagebuilder", chaslayPagebuilderRoutes);
app.use("/api/rfid-readers", rfidReadersRoutes);
app.use("/api/delivery-zones", deliveryZonesRoutes);
app.use("/api/merchant/floor-plans", floorPlansRoutes);
app.use("/api/merchant/reservations", reservationsRoutes);
app.use("/api/merchant/offers", offersRoutes);
app.use("/api/merchant/vouchers", vouchersRoutes);
app.use("/api/merchant/marketing", marketingRoutes);
app.use("/api/merchant/inventory", inventoryRoutes);
app.use("/api/merchant/storekeeper", storekeeperRoutes);
app.use("/api/merchant/delivery", deliveryTrackingRoutes);
app.use("/api/receipts", receiptsRoutes);
app.use("/api/kds", kdsRoutes);
app.use("/api/merchant/kds", kdsMerchantRoutes);
app.use("/api/kiosk", kioskRoutes);
app.use("/api/merchant/kiosk", kioskMerchantRouter);
app.use("/api/ods", odsRoutes);
app.use("/api/merchant/ods", odsMerchantRoutes);
app.use("/api/tv", signageRoutes);
app.use("/api/merchant/signage", signageMerchantRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/webhooks", deliveryPlatformRoutes);
/** Reborn / FoodTruck Android POS (Retrofit /v1/* contract) */
app.use("/v1", chaslayRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);
  const isCors = err.message.startsWith("CORS blocked");
  res.status(isCors ? 403 : 500).json({
    error: isCors ? err.message : "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

void (async () => {
  try {
    console.log("[schema] applying merchant schema patches before listen…");
    await ensureMerchantSchemaAtStartup();
    console.log("[schema] merchant schema patches complete");
  } catch (err) {
    console.warn("[schema] startup patch error (continuing):", err);
  }

  app.listen(PORT, () => {
  console.log(`✅ ${APP_NAME} API running on port ${PORT}`);
  console.log(`🏥 Health check: /health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
  ensureLicensesSchemaAtStartup();
  ensureSubscriptionSchemaAtStartup();
  void import("@/services/platform-reseller.service").then(async ({ PlatformResellerService }) => {
    try {
      await PlatformResellerService.ensure();
      await PlatformResellerService.migrateCatalogOwnership();
    } catch {
      /* non-fatal at boot */
    }
  });
  void import("@/services/subscription-plans.service").then(({ SubscriptionPlansService }) =>
    SubscriptionPlansService.ensureDefaults().catch(() => {})
  );
  void import("@/services/subscription-addons.service").then(({ SubscriptionAddonsService }) =>
    SubscriptionAddonsService.ensureDefaults()
      .then(() => SubscriptionAddonsService.ensureMissingDefaultAddons())
      .catch(() => {})
  );

  // Reminder sweeps (~hourly). Lightweight; skips merchants without email.
  const tick = async () => {
    try {
      const result = await MarketingService.processReorderReminders();
      if (result.sent > 0) {
        console.log(`[marketing] reorder reminders sent: ${result.sent}`);
      }
    } catch (error) {
      console.error("[marketing] reorder reminder job failed", error);
    }
    try {
      const result = await ReservationService.processReminders();
      if (result.sent > 0) {
        console.log(`[reservations] reminders sent: ${result.sent}`);
      }
    } catch (error) {
      console.error("[reservations] reminder job failed", error);
    }
    try {
      const result = await ReservationService.processDailySummaries();
      if (result.sent > 0) {
        console.log(`[reservations] daily summaries sent: ${result.sent}`);
      }
    } catch (error) {
      console.error("[reservations] daily summary job failed", error);
    }
    try {
      const { PosShiftService } = await import("@/services/pos-shift.service");
      const closed = await PosShiftService.autoCloseStaleShifts();
      if (closed > 0) {
        console.log(`[pos-shifts] auto-closed stale shifts: ${closed}`);
      }
    } catch (error) {
      console.error("[pos-shifts] auto-close job failed", error);
    }
    try {
      const { ReportEmailService } = await import("@/services/report-email.service");
      const result = await ReportEmailService.processScheduledReports();
      if (result.sent > 0) {
        console.log(`[report-email] scheduled reports sent: ${result.sent}`);
      }
    } catch (error) {
      console.error("[report-email] scheduled job failed", error);
    }
    try {
      const result = await SubscriptionBillingService.processRecurringRenewals();
      if (result.charged > 0 || result.failed > 0) {
        console.log(
          `[subscription] recurring renewals: charged=${result.charged} failed=${result.failed}`
        );
      }
    } catch (error) {
      console.error("[subscription] recurring renewal job failed", error);
    }
  };
  setTimeout(() => void tick(), 45_000);
  setInterval(() => void tick(), 60 * 60 * 1000);
  });
})();

export default app;
