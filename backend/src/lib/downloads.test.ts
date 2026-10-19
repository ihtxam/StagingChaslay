/**
 * RebornPOS desktop descriptor must be distinct from Print Agent 1.10.6.
 * Run: npx tsx --tsconfig backend/tsconfig.json backend/src/lib/downloads.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";

const src = fs.readFileSync(path.join(__dirname, "downloads.ts"), "utf8");
assert.match(src, /REBORN_POS_SETUP_FILE = "reborn-pos-setup\.exe"/);
assert.match(src, /REBORN_POS_ANDROID_APK_FILE = "reborn-pos-android\.apk"/);
assert.match(src, /export function describeRebornPosAndroidApk/);
assert.match(src, /export function describeRebornPosExe/);
assert.match(src, /id: "pos-android"/);
assert.match(src, /id: "reborn-pos"/);
assert.match(src, /readDownloadManifest\("reborn-pos-setup"\)/);
const rebornPosExeFn = src.match(
  /export function describeRebornPosExe\(\)[\s\S]*?\n\}/
)?.[0];
assert.ok(rebornPosExeFn, "describeRebornPosExe body");
assert.doesNotMatch(rebornPosExeFn!, /print-agent-setup/);

const routes = fs.readFileSync(path.join(__dirname, "../routes/downloads.routes.ts"), "utf8");
assert.match(routes, /\/reborn-pos-setup\.json/);
assert.match(routes, /\/reborn-pos-android\.json/);
assert.match(routes, /describeRebornPosAndroidApk/);
assert.match(routes, /describeRebornPosExe/);
assert.match(routes, /REBORN_POS_SETUP_FILE/);

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../public/downloads/reborn-pos-setup.json"), "utf8")
) as { name?: string; exeFile?: string; displayName?: string };
assert.equal(manifest.name, "reborn-pos");
assert.equal(manifest.exeFile, "reborn-pos-setup.exe");
assert.equal(manifest.displayName, "RebornPOS");

console.log("downloads.test.ts: ok");
