/**
 * Run: cd backend && npx tsx src/lib/terminal-duplicate-error.test.ts
 */
import assert from "node:assert/strict";
import { formatTerminalRegisteredToAnotherMerchantMessage } from "./terminal-duplicate-error.ts";

{
  const msg = formatTerminalRegisteredToAnotherMerchantMessage({
    name: "Brazza Cafe",
    slug: "brazza-cafe",
    supportCode: "CH-001",
  });
  assert.match(msg, /Brazza Cafe/);
  assert.match(msg, /brazza-cafe/);
  assert.match(msg, /CH-001/);
}

{
  const msg = formatTerminalRegisteredToAnotherMerchantMessage({
    name: "Demo Shop",
    slug: null,
    supportCode: null,
  });
  assert.equal(msg, 'Terminal ID is already registered to merchant "Demo Shop"');
}

console.log("terminal-duplicate-error.test.ts: ok");
