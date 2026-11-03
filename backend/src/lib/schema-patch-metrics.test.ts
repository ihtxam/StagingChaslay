/**
 * npx tsx backend/src/lib/schema-patch-metrics.test.ts
 */
import assert from 'node:assert/strict';
import {
  getSchemaPatchMetrics,
  recordSchemaColumnPatch,
  recordSchemaEnsureRun,
} from './schema-patch-metrics';

recordSchemaEnsureRun('testEnsure');
recordSchemaEnsureRun('testEnsure');
const afterEnsure = getSchemaPatchMetrics();
assert.ok(afterEnsure.duplicateEnsureKeys.includes('testEnsure'));

recordSchemaColumnPatch('merchants.foo');
recordSchemaColumnPatch('merchants.foo');
const afterColumn = getSchemaPatchMetrics();
assert.ok(afterColumn.duplicateColumnKeys.includes('merchants.foo'));

console.log('schema-patch-metrics: ok');
