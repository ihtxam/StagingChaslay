/**
 * Platform billing must never use merchant shop Adyen.
 * Run: cd backend && npx tsx src/lib/platform-adyen-credentials.test.ts
 */
import assert from "node:assert/strict";
import {
  diagnosePlatformAdyenBundle,
  formatAdyenCheckoutApiError,
  isPlatformBillingCredentialFailure,
  merchantBillingUnavailableMessage,
  merchantFacingBillingPayload,
  merchantShopAdyenPresent,
  pickPlatformAdyenSource,
  resolvePickedPlatformAdyen,
  validatePlatformAdyenApiKey,
} from "./platform-adyen-credentials.ts";

const shopEnv = {
  ADYEN_API_KEY: "AQE_SHOP_WEB_SERVICE_KEY",
  ADYEN_CLIENT_KEY: "test_SHOP_CLIENT",
  ADYEN_MERCHANT_ACCOUNT: "MerchantShopECOM",
};

const merchantShop = {
  adyenApiKey: "AQE_MERCHANT_ROW_KEY",
  adyenMerchantAccount: "BrazzaShopECOM",
  adyenClientId: "test_merchant_row",
};

const platformDb = {
  apiKey: "AQE_PLATFORM_WEB_SERVICE",
  merchantAccount: "ChaslayPaymentsECOM",
  clientKey: "test_PLATFORM_CLIENT",
  environment: "TEST",
};

{
  const picked = pickPlatformAdyenSource(platformDb, shopEnv, merchantShop);
  assert.equal(picked.source, "superadmin_db");
  assert.equal(picked.values.apiKey, "AQE_PLATFORM_WEB_SERVICE");
  assert.equal(picked.values.merchantAccount, "ChaslayPaymentsECOM");
  assert.equal(picked.values.clientKey, "test_PLATFORM_CLIENT");
  assert.equal(picked.ignoredShop, true);
  assert.notEqual(picked.values.apiKey, shopEnv.ADYEN_API_KEY);
  assert.notEqual(picked.values.apiKey, merchantShop.adyenApiKey);
  assert.notEqual(picked.values.merchantAccount, shopEnv.ADYEN_MERCHANT_ACCOUNT);
  assert.notEqual(picked.values.merchantAccount, merchantShop.adyenMerchantAccount);
  assert.notEqual(picked.values.clientKey, shopEnv.ADYEN_CLIENT_KEY);
  assert.notEqual(picked.values.clientKey, merchantShop.adyenClientId);

  const resolved = resolvePickedPlatformAdyen(picked);
  assert.equal(resolved.apiKey, "AQE_PLATFORM_WEB_SERVICE");
  assert.equal(resolved.merchantAccount, "ChaslayPaymentsECOM");
  assert.ok(resolved.apiBase.includes("checkout-test.adyen.com"));
}

{
  const picked = pickPlatformAdyenSource({}, shopEnv, merchantShop);
  assert.equal(picked.source, "none", "empty Superadmin must not fall back to shop env");
  assert.equal(picked.values.apiKey, "");
  assert.equal(picked.values.merchantAccount, "");
  assert.equal(picked.values.clientKey, "");
  assert.equal(picked.ignoredShop, true);
  assert.deepEqual(picked.missing, ["apiKey", "merchantAccount", "clientKey"]);
  assert.throws(
    () => resolvePickedPlatformAdyen(picked),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Platform Adyen API key is missing|not configured/i);
      assert.doesNotMatch(err.message, /AQE_SHOP|AQE_MERCHANT|BrazzaShop|MerchantShop/);
      return true;
    }
  );
}

{
  const picked = pickPlatformAdyenSource(
    { merchantAccount: "ChaslayPaymentsECOM", environment: "TEST" },
    {
      ...shopEnv,
      PLATFORM_ADYEN_API_KEY: "AQE_SHOULD_NOT_FILL_GAP",
      PLATFORM_ADYEN_CLIENT_KEY: "test_SHOULD_NOT_FILL_GAP",
    },
    merchantShop
  );
  assert.equal(picked.source, "incomplete_db");
  assert.equal(picked.values.apiKey, "", "do not fill API key from shop or PLATFORM env when DB is partial");
  assert.equal(picked.values.clientKey, "");
  assert.equal(picked.values.merchantAccount, "ChaslayPaymentsECOM");
  assert.deepEqual(picked.missing, ["apiKey", "clientKey"]);
}

{
  const env = {
    PLATFORM_ADYEN_API_KEY: "AQE_PLATFORM_ENV",
    PLATFORM_ADYEN_MERCHANT_ACCOUNT: "ChaslayPaymentsECOM",
    PLATFORM_ADYEN_CLIENT_KEY: "test_PLATFORM_ENV",
    PLATFORM_ADYEN_ENVIRONMENT: "TEST",
    ...shopEnv,
  };
  const picked = pickPlatformAdyenSource({}, env, merchantShop);
  assert.equal(picked.source, "platform_env");
  assert.equal(picked.values.apiKey, "AQE_PLATFORM_ENV");
  assert.notEqual(picked.values.apiKey, shopEnv.ADYEN_API_KEY);
  assert.equal(picked.values.merchantAccount, "ChaslayPaymentsECOM");
}

{
  const diagnosis = diagnosePlatformAdyenBundle(
    pickPlatformAdyenSource({}, shopEnv, merchantShop)
  );
  assert.equal(diagnosis.ready, false);
  assert.equal(diagnosis.shopEnvIgnored, true);
  assert.ok(diagnosis.issues.some((issue) => issue.field === "bundle"));
  assert.match(diagnosis.recipe, /Superadmin → Settings → Payment/);
}

{
  assert.throws(
    () => validatePlatformAdyenApiKey("test_looks_like_client"),
    /looks like a client key/
  );
  assert.equal(validatePlatformAdyenApiKey("AQEyhmfxFakeKeyForTest"), "AQEyhmfxFakeKeyForTest");
}

{
  const mixed = pickPlatformAdyenSource({
    apiKey: "AQE_PLATFORM",
    merchantAccount: "ChaslayPaymentsECOM",
    clientKey: "live_SHOULD_NOT_MATCH_TEST",
    environment: "TEST",
  });
  assert.throws(() => resolvePickedPlatformAdyen(mixed), /Environment is TEST/);
}

{
  const unauthorized = formatAdyenCheckoutApiError(
    { response: { status: 401, data: { message: "HTTP Status Response - Unauthorized" } } },
    { apiBase: "https://checkout-test.adyen.com/v71", merchantAccount: "ChaslayPaymentsECOM", phase: "sessions" }
  );
  assert.match(unauthorized, /Adyen POST \/sessions rejected the platform credentials \(Unauthorized, TEST\)/);
  assert.match(unauthorized, /ChaslayPaymentsECOM/);
  assert.match(unauthorized, /Do not mix merchant shop credentials/);

  assert.equal(isPlatformBillingCredentialFailure(new Error(unauthorized)), true);
  assert.equal(
    merchantFacingBillingPayload(new Error(unauthorized), "en").error,
    "Billing is temporarily unavailable. Please try again later."
  );
  assert.equal(merchantFacingBillingPayload(new Error(unauthorized), "en").code, "BILLING_UNAVAILABLE");
  assert.equal(
    merchantFacingBillingPayload(new Error(unauthorized), "fr").error,
    "La facturation est temporairement indisponible. Veuillez réessayer plus tard."
  );
  assert.equal(
    merchantFacingBillingPayload(new Error(unauthorized), "de").error,
    "Die Abrechnung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut."
  );
  assert.doesNotMatch(
    merchantFacingBillingPayload(new Error(unauthorized), "en").error,
    /Superadmin|AQE|ChaslayPaymentsECOM|test_/
  );
}

{
  assert.equal(
    merchantBillingUnavailableMessage("fr-CH"),
    "La facturation est temporairement indisponible. Veuillez réessayer plus tard."
  );
  assert.equal(merchantShopAdyenPresent(merchantShop), true);
  assert.equal(merchantShopAdyenPresent({}), false);
  assert.equal(
    isPlatformBillingCredentialFailure(new Error("This plan is not available for purchase")),
    false
  );
  const planErr = merchantFacingBillingPayload(new Error("This plan is not available for purchase"));
  assert.equal(planErr.error, "This plan is not available for purchase");
  assert.equal(planErr.code, undefined);
}

console.log("platform-adyen-credentials.test.ts OK");
