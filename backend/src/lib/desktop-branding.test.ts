/**
 * Desktop branding defaults and uploads.
 * Run: cd backend && npx tsx src/lib/desktop-branding.test.ts
 */
import assert from "node:assert/strict";
import { DEFAULT_DESKTOP_BRANDING, normalizeDesktopHexColor, resolveDesktopBranding } from "./desktop-branding.ts";

const defaults = resolveDesktopBranding({});
assert.equal(defaults.appName, DEFAULT_DESKTOP_BRANDING.appName);
assert.equal(defaults.tagline, DEFAULT_DESKTOP_BRANDING.tagline);
assert.equal(defaults.backgroundColor, "#17252b");
assert.equal(defaults.splashCustom, false);
assert.match(defaults.splashUrl, /\/brand\/reborn-logo-white\.png$/);

const custom = resolveDesktopBranding({
  splashUrl: "/api/uploads/platform/desktop/splash.png",
  iconUrl: "/api/uploads/platform/desktop/icon.png",
  appName: "  My POS  ",
  tagline: "Hello",
  backgroundColor: "#0f172a",
});
assert.equal(custom.splashCustom, true);
assert.equal(custom.iconCustom, true);
assert.equal(custom.appName, "My POS");
assert.equal(custom.tagline, "Hello");
assert.equal(custom.backgroundColor, "#0f172a");
assert.match(custom.splashUrl, /\/api\/uploads\/platform\/desktop\/splash\.png$/);

assert.equal(normalizeDesktopHexColor("not-a-color"), "#17252b");
assert.equal(normalizeDesktopHexColor("#abc"), "#abc");

console.log("desktop-branding tests passed");
