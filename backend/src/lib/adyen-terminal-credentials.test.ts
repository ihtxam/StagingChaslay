/**
 * Run: cd backend && npx tsx src/lib/adyen-terminal-credentials.test.ts
 */
import assert from "node:assert/strict";
import {
  resolveAdyenTerminalCredentials,
  terminalBelongsToProfile,
} from "./adyen-terminal-credentials.ts";

{
  const resolved = resolveAdyenTerminalCredentials({
    terminal: {
      adyenApiKey: "TERM_KEY",
      adyenMerchantAccount: "TERM_ACCT",
      adyenClientId: "term_client",
      terminalId: "T-1",
    },
    profile: {
      adyenApiKey: "PROFILE_KEY",
      adyenMerchantAccount: "PROFILE_ACCT",
      adyenClientId: "profile_client",
    },
    merchant: {
      adyenApiKey: "MERCH_KEY",
      adyenMerchantAccount: "MERCH_ACCT",
      adyenClientId: "merch_client",
    },
    env: { apiKey: "ENV_KEY", merchantAccount: "ENV_ACCT", clientId: "env_client" },
  });
  assert.equal(resolved.apiKey, "TERM_KEY");
  assert.equal(resolved.merchantAccount, "TERM_ACCT");
  assert.equal(resolved.clientId, "term_client");
  assert.equal(resolved.terminalId, "T-1");
}

{
  const resolved = resolveAdyenTerminalCredentials({
    terminal: { terminalId: "T-2" },
    profile: {
      adyenApiKey: "PROFILE_KEY",
      adyenMerchantAccount: "PROFILE_ACCT",
      adyenClientId: "profile_client",
    },
    merchant: {
      adyenApiKey: "MERCH_KEY",
      adyenMerchantAccount: "MERCH_ACCT",
      adyenClientId: "merch_client",
    },
  });
  assert.equal(resolved.apiKey, "PROFILE_KEY");
  assert.equal(resolved.merchantAccount, "PROFILE_ACCT");
  assert.equal(resolved.clientId, "profile_client");
}

{
  const resolved = resolveAdyenTerminalCredentials({
    merchant: {
      adyenApiKey: "MERCH_KEY",
      adyenMerchantAccount: "MERCH_ACCT",
      adyenClientId: "merch_client",
    },
    env: { apiKey: "ENV_KEY", merchantAccount: "ENV_ACCT", clientId: "env_client" },
  });
  assert.equal(resolved.apiKey, "MERCH_KEY");
  assert.equal(resolved.merchantAccount, "MERCH_ACCT");
}

assert.equal(terminalBelongsToProfile(null, "p-default", "p-default"), true);
assert.equal(terminalBelongsToProfile(null, "p1", "p-default"), false);
assert.equal(terminalBelongsToProfile("p1", "p1", "p-default"), true);
assert.equal(terminalBelongsToProfile("p2", "p1", "p-default"), false);
assert.equal(terminalBelongsToProfile(null, null, null), true);

console.log("adyen-terminal-credentials.test.ts: ok");
