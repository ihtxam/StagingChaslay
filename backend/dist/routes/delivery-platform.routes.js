"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const delivery_platform_service_1 = require("@/services/delivery-platform.service");
const delivery_platform_settings_1 = require("@/lib/delivery-platform-settings");
const delivery_platform_webhook_mappers_1 = require("@/lib/delivery-platform-webhook-mappers");
const router = (0, express_1.Router)();
function readRawBody(req) {
    if (req.rawBody)
        return req.rawBody;
    if (typeof req.body === "string")
        return req.body;
    if (Buffer.isBuffer(req.body))
        return req.body.toString("utf8");
    return JSON.stringify(req.body || {});
}
const JUST_EAT_JET_CONNECT_SUFFIXES = [
    "order-ready-for-preparation-sync",
    "order-ready-for-preparation-async",
    "acceptance-requested",
];
async function handleJustEatWebhook(webhookPath, req, res) {
    const merchantId = String(req.params.merchantId || "").trim();
    if (!merchantId) {
        return res.status(400).json({ error: "merchantId is required" });
    }
    const rawBody = readRawBody(req);
    const isAsync = webhookPath.includes("async") || typeof req.query.callback === "string";
    const callbackUrl = typeof req.query.callback === "string" ? req.query.callback.trim() : "";
    try {
        await delivery_platform_service_1.DeliveryPlatformService.verifyWebhook({
            platform: "just-eat",
            merchantId,
            headers: req.headers,
            rawBody,
        });
        const mapped = (0, delivery_platform_webhook_mappers_1.mapJustEatWebhookBody)(req.body);
        const source = (0, delivery_platform_settings_1.orderSourceFromPlatform)("just-eat");
        if (!source || source === "online_shop") {
            return res.status(400).json({ error: "Unknown delivery platform" });
        }
        const payload = delivery_platform_service_1.DeliveryPlatformService.normalizeWebhookPayload(mapped);
        const result = await delivery_platform_service_1.DeliveryPlatformService.ingestOrder(merchantId, source, payload);
        if (isAsync) {
            res.status(202).end();
            if (callbackUrl) {
                void delivery_platform_service_1.DeliveryPlatformService.sendJetConnectAsyncCallback(callbackUrl, true, result.created
                    ? "Order successfully sent to POS"
                    : "Order already received by POS");
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
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "Webhook failed";
        const status = /disabled|signature|unknown/i.test(msg) ? 401 : /required|item/i.test(msg) ? 400 : 500;
        console.error(`Just Eat webhook (${webhookPath || "root"}):`, error);
        if (isAsync && callbackUrl) {
            res.status(202).end();
            void delivery_platform_service_1.DeliveryPlatformService.sendJetConnectAsyncCallback(callbackUrl, false, msg);
            return;
        }
        res.status(status).json({ error: msg });
    }
}
async function handlePlatformWebhook(platform, req, res) {
    try {
        const merchantId = String(req.params.merchantId || "").trim();
        if (!merchantId) {
            return res.status(400).json({ error: "merchantId is required" });
        }
        const rawBody = readRawBody(req);
        await delivery_platform_service_1.DeliveryPlatformService.verifyWebhook({
            platform,
            merchantId,
            headers: req.headers,
            rawBody,
        });
        const slug = String(platform).toLowerCase();
        let mapped = req.body;
        if (slug.includes("just"))
            mapped = (0, delivery_platform_webhook_mappers_1.mapJustEatWebhookBody)(req.body);
        if (slug.includes("uber"))
            mapped = (0, delivery_platform_webhook_mappers_1.mapUberEatsWebhookBody)(req.body);
        if (slug.includes("uber")) {
            mapped = await delivery_platform_service_1.DeliveryPlatformService.enrichUberWebhookBody(merchantId, mapped);
        }
        const source = (0, delivery_platform_settings_1.orderSourceFromPlatform)(platform);
        if (!source || source === "online_shop") {
            return res.status(400).json({ error: "Unknown delivery platform" });
        }
        const payload = delivery_platform_service_1.DeliveryPlatformService.normalizeWebhookPayload(mapped);
        const result = await delivery_platform_service_1.DeliveryPlatformService.ingestOrder(merchantId, source, payload);
        res.status(result.created ? 201 : 200).json({
            success: true,
            created: result.created,
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
            status: result.order.status,
            orderSource: result.order.orderSource,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "Webhook failed";
        const status = /disabled|signature|unknown/i.test(msg) ? 401 : /required|item/i.test(msg) ? 400 : 500;
        console.error(`Delivery platform webhook (${platform}):`, error);
        res.status(status).json({ error: msg });
    }
}
for (const suffix of JUST_EAT_JET_CONNECT_SUFFIXES) {
    router.post(`/just-eat/:merchantId/${suffix}`, (req, res) => void handleJustEatWebhook(suffix, req, res));
}
/** POST /api/webhooks/just-eat/:merchantId — legacy / manual test POST */
router.post("/just-eat/:merchantId", (req, res) => void handleJustEatWebhook("", req, res));
/** POST /api/webhooks/uber-eats/:merchantId */
router.post("/uber-eats/:merchantId", (req, res) => void handlePlatformWebhook("uber-eats", req, res));
/** POST /api/webhooks/delivery-platforms/:platform/:merchantId/test — sandbox ingest */
router.post("/delivery-platforms/:platform/:merchantId/test", async (req, res) => {
    try {
        const merchantId = String(req.params.merchantId || "").trim();
        const platform = String(req.params.platform || "").trim();
        const source = (0, delivery_platform_settings_1.orderSourceFromPlatform)(platform);
        if (!source || source === "online_shop") {
            return res.status(400).json({ error: "platform must be just-eat or uber-eats" });
        }
        const { cfg } = await delivery_platform_service_1.DeliveryPlatformService.getPlatformConfig(merchantId, platform);
        if (!cfg.enabled) {
            return res.status(403).json({ error: "Platform integration is disabled" });
        }
        if (!cfg.testMode && process.env.NODE_ENV === "production") {
            return res.status(403).json({ error: "Test endpoint requires test mode enabled" });
        }
        if (!cfg.testMode) {
            const hasProd = (source === "justeat" && cfg.apiKey && cfg.webhookSecret) ||
                (source === "ubereats" && cfg.clientId && cfg.clientSecret);
            if (hasProd) {
                return res.status(403).json({
                    error: "Test endpoint disabled when production credentials are configured",
                });
            }
        }
        const payload = delivery_platform_service_1.DeliveryPlatformService.normalizeWebhookPayload(req.body);
        const result = await delivery_platform_service_1.DeliveryPlatformService.ingestOrder(merchantId, source, payload);
        res.status(result.created ? 201 : 200).json({
            success: true,
            created: result.created,
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "Test ingest failed";
        res.status(400).json({ error: msg });
    }
});
exports.default = router;
//# sourceMappingURL=delivery-platform.routes.js.map