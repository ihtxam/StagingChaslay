import { Router, Request, Response } from "express";
import { DeliveryPlatformService } from "@/services/delivery-platform.service";
import { orderSourceFromPlatform } from "@/lib/delivery-platform-settings";
import {
  mapJustEatWebhookBody,
  mapUberEatsWebhookBody,
} from "@/lib/delivery-platform-webhook-mappers";

const router = Router();

async function handlePlatformWebhook(platform: string, req: Request, res: Response) {
  try {
    const merchantId = String(req.params.merchantId || "").trim();
    if (!merchantId) {
      return res.status(400).json({ error: "merchantId is required" });
    }

    const rawBody =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString("utf8")
          : JSON.stringify(req.body || {});

    await DeliveryPlatformService.verifyWebhook({
      platform,
      merchantId,
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody,
    });

    const slug = String(platform).toLowerCase();
    let mapped: unknown = req.body;
    if (slug.includes("just")) mapped = mapJustEatWebhookBody(req.body);
    if (slug.includes("uber")) mapped = mapUberEatsWebhookBody(req.body);
    if (slug.includes("uber")) {
      mapped = await DeliveryPlatformService.enrichUberWebhookBody(merchantId, mapped);
    }

    const source = orderSourceFromPlatform(platform);
    if (!source || source === "online_shop") {
      return res.status(400).json({ error: "Unknown delivery platform" });
    }

    const payload = DeliveryPlatformService.normalizeWebhookPayload(mapped);
    const result = await DeliveryPlatformService.ingestOrder(merchantId, source, payload);

    res.status(result.created ? 201 : 200).json({
      success: true,
      created: result.created,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      status: result.order.status,
      orderSource: result.order.orderSource,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Webhook failed";
    const status =
      /disabled|signature|unknown/i.test(msg) ? 401 : /required|item/i.test(msg) ? 400 : 500;
    console.error(`Delivery platform webhook (${platform}):`, error);
    res.status(status).json({ error: msg });
  }
}

/** POST /api/webhooks/just-eat/:merchantId */
router.post("/just-eat/:merchantId", (req, res) => void handlePlatformWebhook("just-eat", req, res));

/** POST /api/webhooks/uber-eats/:merchantId */
router.post("/uber-eats/:merchantId", (req, res) => void handlePlatformWebhook("uber-eats", req, res));

/** POST /api/webhooks/delivery-platforms/:platform/:merchantId/test — sandbox ingest */
router.post("/delivery-platforms/:platform/:merchantId/test", async (req: Request, res: Response) => {
  try {
    const merchantId = String(req.params.merchantId || "").trim();
    const platform = String(req.params.platform || "").trim();
    const source = orderSourceFromPlatform(platform);
    if (!source || source === "online_shop") {
      return res.status(400).json({ error: "platform must be just-eat or uber-eats" });
    }

    const { cfg } = await DeliveryPlatformService.getPlatformConfig(merchantId, platform);
    if (!cfg.enabled) {
      return res.status(403).json({ error: "Platform integration is disabled" });
    }
    if (!cfg.testMode && process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Test endpoint requires test mode enabled" });
    }
    if (!cfg.testMode) {
      const hasProd =
        (source === "justeat" && cfg.apiKey && cfg.apiSecret) ||
        (source === "ubereats" && cfg.clientId && cfg.clientSecret);
      if (hasProd) {
        return res.status(403).json({
          error: "Test endpoint disabled when production credentials are configured",
        });
      }
    }

    const payload = DeliveryPlatformService.normalizeWebhookPayload(req.body);
    const result = await DeliveryPlatformService.ingestOrder(merchantId, source, payload);
    res.status(result.created ? 201 : 200).json({
      success: true,
      created: result.created,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Test ingest failed";
    res.status(400).json({ error: msg });
  }
});

export default router;
