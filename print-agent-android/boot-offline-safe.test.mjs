import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Reboot with no WiFi must not crash Bridge. Source guards — no Android runtime. */
const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'app/src/main/java/com/rebornsense/printbridge');

const application = readFileSync(join(src, 'PrintBridgeApplication.kt'), 'utf8');
const unlock = readFileSync(join(src, 'BridgeUserUnlock.kt'), 'utf8');
const boot = readFileSync(join(src, 'boot/BootCompletedReceiver.kt'), 'utf8');
const usb = readFileSync(join(src, 'usb/UsbAttachReceiver.kt'), 'utf8');
const prefs = readFileSync(join(src, 'print/PrinterPreferences.kt'), 'utf8');
const gradle = readFileSync(join(root, 'app/build.gradle.kts'), 'utf8');
const http = readFileSync(join(src, 'http/BridgeHttpServer.kt'), 'utf8');

assert.match(unlock, /fun isCredentialStorageReady/);
assert.match(unlock, /isUserUnlocked/);

assert.match(application, /BridgeUserUnlock\.isCredentialStorageReady/);
assert.match(application, /runCatching \{ UsbHostPermissions\.recordGrantedDevices/);
assert.match(application, /AdyenApplicationHooks/);
assert.match(application, /Never throw out of Application\.onCreate/);

assert.match(boot, /BridgeUserUnlock\.isCredentialStorageReady/);
assert.match(boot, /startBridgeIfReady/);

assert.match(usb, /runCatching \{/);
assert.match(usb, /BridgeUserUnlock\.isCredentialStorageReady/);
assert.match(usb, /EARLY_BOOT_MS/);
assert.match(usb, /Skip USB permission dialog during early boot/);

assert.match(prefs, /isAutoStartEnabled[\s\S]*runCatching/);
assert.match(prefs, /getLanHosts[\s\S]*runCatching/);

assert.match(http, /NanoHTTPD\("127\.0\.0\.1"/);

assert.match(gradle, /versionName = "0\.4\.31"/);
assert.match(gradle, /versionCode = 49/);
assert.doesNotMatch(boot, /120_000L/);
const settings = readFileSync(join(root, 'settings.gradle.kts'), 'utf8');
assert.match(settings, /id\("com\.android\.application"\) version "8\.7\.2"/);

console.log('boot-offline-safe.test.mjs OK');
