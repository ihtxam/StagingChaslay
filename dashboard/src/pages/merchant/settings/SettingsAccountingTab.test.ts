import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'SettingsAccountingTab.tsx'), 'utf8');

test('SettingsAccountingTab uses SettingsReportCard with required icon, accent, and title', () => {
  assert.match(src, /<SettingsReportCard[\s\S]*?icon=\{Calculator\}/);
  assert.match(src, /<SettingsReportCard[\s\S]*?accent=\{settingsDash\.accent\}/);
  assert.match(src, /<SettingsReportCard[\s\S]*?title=\{t\('settingsAccounting'\)\}/);
  assert.doesNotMatch(src, /<SettingsReportCard>\s*\n/);
  assert.match(src, /SettingsToggleRow[\s\S]*?title=\{t\('accountingEnabled'\)\}/);
});
