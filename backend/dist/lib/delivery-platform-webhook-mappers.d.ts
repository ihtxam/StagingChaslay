export declare function isJetConnectOrderPayload(body: unknown): boolean;
/**
 * Map JET Connect `order-ready-for-preparation` webhook bodies.
 * @see https://uk.api.just-eat.io/docs/jetconnect/index.html
 */
export declare function mapJetConnectWebhookBody(body: unknown): unknown;
/**
 * Map Just Eat webhook bodies (JET Connect + legacy Flyt-style) to normalized ingest shape.
 */
export declare function mapJustEatWebhookBody(body: unknown): unknown;
/**
 * Map Uber Eats `orders.notification` (and related) webhook bodies.
 * Notification-only payloads may omit line items — caller should fetch order details when possible.
 */
export declare function mapUberEatsWebhookBody(body: unknown): unknown;
export declare function isUberNotificationOnly(mapped: unknown): boolean;
//# sourceMappingURL=delivery-platform-webhook-mappers.d.ts.map