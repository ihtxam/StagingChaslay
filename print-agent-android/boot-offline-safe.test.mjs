import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Reboot with no WiFi must not crash Bridge. Source guards — no Android runtime. */
const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'app/src/main/java/com/rebornsense/printbridge');

const application = readFileSync(join(src, 'PrintBridgeApplication.kt'), 'utf8');
const mainActivity = readFileSync(join(src, 'MainActivity.kt'), 'utf8');
const unlock = readFileSync(join(src, 'BridgeUserUnlock.kt'), 'utf8');
const boot = readFileSync(join(src, 'boot/BootCompletedReceiver.kt'), 'utf8');
const usb = readFileSync(join(src, 'usb/UsbAttachReceiver.kt'), 'utf8');
const btHotplug = readFileSync(join(src, 'bluetooth/BluetoothPrinterHotplugReceiver.kt'), 'utf8');
const launcher = readFileSync(join(src, 'PrintBridgeLauncher.kt'), 'utf8');
const attachActivity = readFileSync(join(src, 'usb/UsbPrinterAttachActivity.kt'), 'utf8');
const manifest = readFileSync(join(root, 'app/src/main/AndroidManifest.xml'), 'utf8');
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

assert.match(usb, /ACTION_USB_DEVICE_DETACHED/);
assert.match(usb, /ACTION_USB_DEVICE_ATTACHED/);
assert.match(usb, /UsbPlugPlay\.promptForMissingPrinter/);
assert.match(usb, /clearSuppressForDevice/);
assert.match(usb, /refreshAfterHardwareChange/);

assert.match(btHotplug, /ACTION_ACL_CONNECTED/);
assert.match(btHotplug, /BOND_STATE_CHANGED/);
assert.match(launcher, /refreshAfterHardwareChange/);

assert.match(attachActivity, /ACTION_USB_DEVICE_ATTACHED/);
assert.match(attachActivity, /PrintBridgeLauncher\.start\(this/);

assert.match(manifest, /UsbPrinterAttachActivity/);
assert.match(manifest, /USB_DEVICE_ATTACHED/);
assert.match(manifest, /usb_device_filter/);
assert.match(manifest, /BluetoothPrinterHotplugReceiver/);

assert.match(prefs, /isAutoStartEnabled[\s\S]*runCatching/);
assert.match(prefs, /getLanHosts[\s\S]*runCatching/);

assert.match(http, /NanoHTTPD\("127\.0\.0\.1"/);

assert.match(application, /runWithBootReceiverStart \{[\s\S]*PrintBridgeLauncher\.startIfEnabled/);
assert.match(launcher, /recordBlockedStartInCrashLog/);
assert.match(gradle, /versionName = "0\.4\.46"/);
assert.match(gradle, /versionCode = 64/);
assert.match(attachActivity, /schedulePermissionPrompt/);
assert.match(
  mainActivity,
  /onResume\(\)[\s\S]*tryRunUsbPermissionLaunch\(\)/,
);
assert.match(mainActivity, /EXTRA_REQUEST_USB_PERMISSION/);
assert.match(readFileSync(join(src, 'usb/UsbPlugPlay.kt'), 'utf8'), /allowForegroundActivity/);
assert.doesNotMatch(boot, /scheduleUsbPermissionPrompts/);
assert.doesNotMatch(
  readFileSync(join(src, 'usb/UsbBootPermissionNotifier.kt'), 'utf8'),
  /setFullScreenIntent/,
);
assert.match(manifest, /showWhenLocked="true"/);
assert.match(attachActivity, /clearStalePendingRequest\(usb, maxAgeMs = 3_000L\)/);
assert.match(usb, /UsbPlugPlay/);
assert.match(boot, /BootAutostartNotifier/);
assert.match(attachActivity, /shouldOfferUsbAccessOnAttach/);
assert.match(mainActivity, /setStartBridgeButtonVisible/);
assert.doesNotMatch(boot, /120_000L/);
const settings = readFileSync(join(root, 'settings.gradle.kts'), 'utf8');
assert.match(settings, /id\("com\.android\.application"\) version "8\.7\.2"/);

console.log('boot-offline-safe.test.mjs OK');
