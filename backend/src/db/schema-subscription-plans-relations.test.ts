/**
 * Drizzle relational queries on subscription_plans require this export.
 * Missing it throws: Cannot read properties of undefined (reading 'referencedTable')
 * Run: npx tsx src/db/schema-subscription-plans-relations.test.ts
 */
import assert from "node:assert/strict";
import * as schema from "./schema";

assert.ok(schema.subscriptionPlansRelations, "subscriptionPlansRelations must be exported");
assert.ok(
  "config" in schema.subscriptionPlansRelations,
  "subscriptionPlansRelations must be a drizzle relations() object"
);

console.log("schema-subscription-plans-relations.test.ts: ok");
