/**
 * npx tsx backend/src/lib/schema-bootstrap-mode.test.ts
 */
import assert from "node:assert/strict";
import {
  getMerchantSchemaBootstrapMode,
  isLazyMerchantSchemaBootstrap,
} from "./schema-bootstrap-mode";

const prev = process.env.MERCHANT_SCHEMA_BOOTSTRAP;

function withEnv(value: string | undefined, fn: () => void) {
  if (value === undefined) delete process.env.MERCHANT_SCHEMA_BOOTSTRAP;
  else process.env.MERCHANT_SCHEMA_BOOTSTRAP = value;
  fn();
}

withEnv(undefined, () => {
  assert.equal(getMerchantSchemaBootstrapMode(), "full");
  assert.equal(isLazyMerchantSchemaBootstrap(), false);
});

withEnv("lazy", () => {
  assert.equal(getMerchantSchemaBootstrapMode(), "lazy");
  assert.equal(isLazyMerchantSchemaBootstrap(), true);
});

withEnv("migrate_only", () => {
  assert.equal(getMerchantSchemaBootstrapMode(), "lazy");
});

withEnv("FULL", () => {
  assert.equal(getMerchantSchemaBootstrapMode(), "full");
});

if (prev === undefined) delete process.env.MERCHANT_SCHEMA_BOOTSTRAP;
else process.env.MERCHANT_SCHEMA_BOOTSTRAP = prev;

console.log("schema-bootstrap-mode: ok");
