import { Router, Request, Response } from "express";
import { DeliveryPlatformService } from "@/services/delivery-platform.service";
import { orderSourceFromPlatform } from "@/lib/delivery-platform-settings";
import {
  mapJustEatWebhookBody,
  mapUberEatsWebhookBody,
} from "@/lib/delivery-platform-webhook-mappers";

const router = Router();

type RawBodyRequest = Request & { rawBody?: string };

function readRawBody(req: RawBodyRequest): string {
  if (req.rawBody) return req.rawBody;
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  return JSON.stringify(req.body || {});
}

const JUST_EAT_JET_CONNECT_SUFFIXES = [
  "order-ready-for-preparation-sync",
  "order-ready-for-preparation-async",
  "acceptance-requested",
] as const;

async function handleJustEatWebhook(
  webhookPath: string,
  req: RawBodyRequest,
  res: Response
) {
  const merchantId = String(req.params.merchantId || "").trim();
  if (!merchantId) {
    return res.status(400).json({ error: "merchantId is required" });
  }

  const rawBody = readRawBody(req);
  const isAsync =
    webhookPath.includes("async") || typeof req.query.callback === "string";
  const callbackUrl =
    typeof req.query.callback === "string" ? req.query.callback.trim() : "";

  try {
    await DeliveryPlatformService.verifyWebhook({
      platform: "just-eat",
      merchantId,
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody,
    });

    const mapped = mapJustEatWebhookBody(req.body);
    const source = orderSourceFromPlatform("just-eat");
    if (!source || source === "online_shop") {
      return res.status(400).json({ error: "Unknown delivery platform" });
    }

    const payload = DeliveryPlatformService.normalizeWebhookPayload(mapped);
    const result = await DeliveryPlatformService.ingestOrder(merchantId, source, payload);

    if (isAsync) {
      res.status(202).end();
      if (callbackUrl) {
        void DeliveryPlatformService.sendJetConnectAsyncCallback(
          callbackUrl,
          true,
          result.created
            ? "Order successfully sent to POS"
            : "Order already received by POS"
        );
      }
      return;
    }

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
    console.error(`Just Eat webhook (${webhookPath || "root"}):`, error);

    if (isAsync && callbackUrl) {
      res.status(202).end();
      void DeliveryPlatformService.sendJetConnectAsyncCallback(callbackUrl, false, msg);
      return;
    }

    res.status(status).json({ error: msg });
  }
}

async function handlePlatformWebhook(platform: string, req: RawBodyRequest, res: Response) {
  try {
    const merchantId = String(req.params.merchantId || "").trim();
    if (!merchantId) {
      return res.status(400).json({ error: "merchantId is required" });
    }

    const rawBody = readRawBody(req);

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

for (const suffix of JUST_EAT_JET_CONNECT_SUFFIXES) {
  router.post(`/just-eat/:merchantId/${suffix}`, (req, res) =>
    void handleJustEatWebhook(suffix, req, res)
  );
}

/** POST /api/webhooks/just-eat/:merchantId — legacy / manual test POST */
router.post("/just-eat/:merchantId", (req, res) => void handleJustEatWebhook("", req, res));

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
        (source === "justeat" && cfg.apiKey && cfg.webhookSecret) ||
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
