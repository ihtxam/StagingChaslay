# Bridge Reborn (`print-agent-android/`) — locked

This Android companion app is **frozen** for routine product work. WebPOS, dashboard, and backend changes should not refactor Bridge UX, boot, FGS, USB plug-and-play, or autostart unless explicitly approved.

**Stable baseline (2026-10-20):** `0.4.46` (versionCode 64) — USB ESC/POS pass-through, BT cut trailer, boot/offline-safe start. Treat this tree as locked; kitchen/receipt cut policy lives in dashboard `webpos-receipt.ts` + `webpos-print-relay.ts`, not in Bridge drivers.

## Allowed without escalation

- Documentation (README, signing, device notes)
- Version bump + APK rebuild when required for a approved fix
- `build.gradle.kts` signing / CI wiring (no behavior change)
- Critical production fixes (crash, security) with a short rationale in the PR

## Requires explicit approval

- New permissions, manifest components, or OEM boot flows
- UX changes to setup wizard, notifications, or main activity
- Refactors, dependency upgrades, or “cleanup” drives

## Review

Changes under `print-agent-android/**` should be reviewed by a maintainer familiar with Android deploy and signing (see root `CODEOWNERS`).
