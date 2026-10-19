/**
 * Adyen SoftPOS envelope builders — run: cd backend && npx tsx src/services/adyen-softpos.service.test.ts
 *
 * Pins the reference contract Tap to Pay reconciliation depends on: the POS
 * transaction id supplied as `reference` must become the SaleTransactionID, so
 * that Adyen echoes it back as merchantReference on the AUTHORISATION webhook
 * and findOrderByReference can match it against orders.client_id.
 */
import assert from "node:assert/strict";
import { buildSaleRequest, buildReversalRequest } from "./adyen-softpos.service.ts";

type Merchant = Parameters<typeof buildSaleRequest>[0];

const merchant = { id: "merchant-1" } as Merchant;
const installationId = "POIID-0001";

function saleData(request: Record<string, unknown>) {
  const envelope = request.SaleToPOIRequest as Record<string, unknown>;
  return {
    header: envelope.MessageHeader as Record<string, unknown>,
    transactionId: (
      (
        (envelope.PaymentRequest as Record<string, unknown>).SaleData as Record<string, unknown>
      ).SaleTransactionID as Record<string, unknown>
    ).TransactionID as string,
    amounts: (
      (envelope.PaymentRequest as Record<string, unknown>).PaymentTransaction as Record<
        string,
        unknown
      >
    ).AmountsReq as Record<string, unknown>,
  };
}

// A supplied reference is used verbatim as the SaleTransactionID.
{
  const reference = "6f1b1b7e-2b7a-4f0e-9a1a-1c2d3e4f5a6b";
  const built = buildSaleRequest(merchant, installationId, 2095, "CHF", reference);
  const { header, transactionId, amounts } = saleData(built.request);

  assert.equal(transactionId, reference);
  assert.equal(built.transactionId, reference);
  assert.equal(header.POIID, installationId);
  assert.equal(header.SaleID, `POS-${merchant.id}`);
  assert.equal(header.MessageCategory, "Payment");
  // Terminal API takes major units; the POS sends minor.
  assert.equal(amounts.RequestedAmount, 20.95);
  assert.equal(amounts.Currency, "CHF");
}

// A UUID reference fits orders.client_id (varchar 64) and the route's 80-char cap.
{
  const reference = "6f1b1b7e-2b7a-4f0e-9a1a-1c2d3e4f5a6b";
  assert.ok(reference.length <= 64, "reference must fit orders.client_id varchar(64)");
  assert.ok(reference.length <= 80, "reference must fit the /sale zod max");
}

// Without a reference the builder mints its own id — the pre-Phase-2 behaviour that
// left payments unreconcilable. Two calls must differ, proving a retry would have
// produced a second, unmatchable transaction.
{
  const a = saleData(buildSaleRequest(merchant, installationId, 100, "CHF", "").request);
  const b = saleData(buildSaleRequest(merchant, installationId, 100, "CHF", "").request);

  assert.ok(a.transactionId.startsWith("TX-"));
  assert.ok(b.transactionId.startsWith("TX-"));
  assert.notEqual(a.transactionId, b.transactionId);
}

// The same reference is stable across retries, which is what engages the /sale
// idempotency cache and prevents a retried request becoming a second charge.
{
  const reference = "stable-retry-reference";
  const first = buildSaleRequest(merchant, installationId, 500, "CHF", reference);
  const second = buildSaleRequest(merchant, installationId, 500, "CHF", reference);

  assert.equal(first.transactionId, second.transactionId);
  // ServiceID is per-attempt and must NOT be reused.
  assert.notEqual(first.serviceId, second.serviceId);
}

// Reversal envelopes target the original transaction, not a fresh id.
{
  const built = buildReversalRequest(merchant, installationId, "original-service-id", 2095, "CHF");
  const envelope = built.request.SaleToPOIRequest as Record<string, unknown>;
  const reversal = envelope.ReversalRequest as Record<string, unknown>;
  const original = (reversal.OriginalPOITransaction as Record<string, unknown>)
    .POITransactionID as Record<string, unknown>;

  assert.equal(original.TransactionID, "original-service-id");
  assert.equal(reversal.ReversedAmount, 20.95);
  assert.equal((envelope.MessageHeader as Record<string, unknown>).MessageCategory, "Reversal");
}

console.log("adyen-softpos.service tests passed");
