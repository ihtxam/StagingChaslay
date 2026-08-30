import { createHmac, timingSafeEqual } from "crypto";

/** Fields Adyen signs for Standard notification webhooks (NotificationRequestItem). */
export interface AdyenNotificationRequestItem {
  pspReference?: string;
  originalReference?: string | null;
  merchantAccountCode?: string;
  merchantReference?: string;
  amount?: { value?: number | string; currency?: string };
  eventCode?: string;
  success?: string | boolean;
  additionalData?: Record<string, string | undefined> | null;
}

const HMAC_SIGNATURE_KEY = "hmacSignature";

function secureCompare(expected: string, received: string | undefined): boolean {
  if (!received) return false;
  const expectedBuffer = Buffer.from(expected, "base64");
  const receivedBuffer = Buffer.from(received, "base64");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

/** Build the colon-separated payload Adyen signs for payment notifications. */
export function getAdyenNotificationDataToSign(item: AdyenNotificationRequestItem): string {
  return [
    item.pspReference ?? "",
    item.originalReference ?? "",
    item.merchantAccountCode ?? "",
    item.merchantReference ?? "",
    item.amount?.value ?? "",
    item.amount?.currency ?? "",
    item.eventCode ?? "",
    String(item.success ?? ""),
  ].join(":");
}

/** Compute expected HMAC (base64) for a Standard notification item. Key is hex from Customer Area. */
export function calculateAdyenNotificationHmac(
  item: AdyenNotificationRequestItem,
  hmacKeyHex: string,
): string {
  const data = getAdyenNotificationDataToSign(item);
  return createHmac("sha256", Buffer.from(hmacKeyHex, "hex"))
    .update(data, "utf8")
    .digest("base64");
}

/** Verify additionalData.hmacSignature on a notification item. */
export function verifyAdyenNotificationHmac(
  item: AdyenNotificationRequestItem,
  hmacKeyHex: string,
): boolean {
  const received = item.additionalData?.[HMAC_SIGNATURE_KEY];
  if (!received) return false;
  const expected = calculateAdyenNotificationHmac(item, hmacKeyHex);
  return secureCompare(expected, received);
}
