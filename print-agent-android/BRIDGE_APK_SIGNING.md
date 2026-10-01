# Bridge Reborn APK signing (package upgrades)

## Application ID (always use this)

| Field | Value |
|-------|--------|
| **Package / applicationId** | `com.rebornsense.printbridge` |
| **App label** | Bridge Reborn |

In-place upgrades only work when the installed app has the **same** `applicationId` **and** the **same signing certificate** as the APK you are installing.

There has never been a `com.chaslay.*` Bridge package in this repo; if a tablet shows a conflict, check for a second app also named **Bridge Reborn** or an old sideload from another build machine.

## Why some tablets show “App not installed” / package conflict

Release APKs are signed at build time. If a merchant installed Bridge from:

- a **local** `./gradlew assembleRelease` on a developer PC, or
- an older **Hetzner deploy** that generated a fresh debug keystore inside Docker, or
- a **GitHub Actions** run before the signing keystore was cached,

…then a newer APK from staging/production may be signed with a **different** key. Android blocks the update (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Lenovo devices that “just work” often received every build from the same server keystore.

**Fix for merchants:** Android Settings → Apps → **Bridge Reborn** (`com.rebornsense.printbridge`) → **Uninstall**, then install again from Merchant Settings → Receipts & printers. Delete stale `reborn-print-bridge*.apk` files in Downloads first.

**Fix for operators:** Use one shared keystore for all official builds (see below). After that, future panel downloads upgrade in place.

## Official builds must share one keystore

1. Generate once (store offline; do **not** commit the file):

   ```bash
   keytool -genkeypair -v \
     -keystore bridge-release.keystore \
     -storepass '…' -keypass '…' -alias bridge \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -dname "CN=Reborn Print Bridge,O=Reborn,C=CH"
   ```

2. On build hosts, set in `print-agent-android/local.properties` (or repo-root `local.properties`):

   ```properties
   bridgeStoreFile=../.secrets/bridge-release.keystore
   bridgeStorePassword=…
   bridgeKeyAlias=bridge
   bridgeKeyPassword=…
   ```

3. **GitHub Actions:** optional repo secrets `BRIDGE_KEYSTORE_BASE64`, `BRIDGE_KEYSTORE_PASSWORD`, `BRIDGE_KEY_ALIAS`, `BRIDGE_KEY_PASSWORD`. The workflow decodes the keystore when present; otherwise it uses a **cached** debug keystore so CI builds stay consistent.

4. **Hetzner deploy:** place the same file at `.secrets/bridge-release.keystore` on the server (gitignored). `scripts/deploy-hetzner.sh` mounts it into the Android build container.

## Manifest notes

- No `android:sharedUserId` — not used.
- Default `installLocation` (internal) — no conflict from `preferExternal`.
- Release builds use `signingConfig release` only; do not mix debug-signed and release-signed installs for the same package.

## Code changes

See `LOCKED.md` — Bridge app code is frozen except critical fixes with explicit approval.
