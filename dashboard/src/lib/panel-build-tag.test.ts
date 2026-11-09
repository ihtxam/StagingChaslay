/**
 * Run: npx tsx dashboard/src/lib/panel-build-tag.test.ts
 */
import assert from 'node:assert/strict';
import { formatPanelDatedBuildTag, panelBuildDayKey } from './panel-build-tag.ts';

const zurichNoon = new Date('2026-11-09T11:00:00.000Z');

assert.equal(formatPanelDatedBuildTag(zurichNoon, 1), 'v091126.1');
assert.equal(formatPanelDatedBuildTag(zurichNoon, 3), 'v091126.3');
assert.equal(panelBuildDayKey(zurichNoon), '091126');

console.log('panel-build-tag.test.ts OK');
