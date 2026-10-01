# Bridge Reborn (`print-agent-android/`) — locked

This Android companion app is **frozen** for routine product work. WebPOS, dashboard, and backend changes should not refactor Bridge UX, boot, FGS, or autostart unless explicitly approved.

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
