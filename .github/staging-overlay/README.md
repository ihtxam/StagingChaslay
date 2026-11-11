# StagingChaslay workflow overlay

Files here are **not** used on rebornSense day-to-day. They seed or document what belongs on the **StagingChaslay** mirror only.

## When sync uses this folder

`sync-staging-chaslay.yml` copies `deploy-hetzner.yml` from here **only** when StagingChaslay has no fetchable `main` yet (first bootstrap). Otherwise it **reuses** `.github/workflows/` already on StagingChaslay `main` so routine mirrors do not add, change, or delete workflow files (which would require PAT **workflow** scope).

## What must stay on the mirror

- `deploy-hetzner.yml` — auto-deploy to `app.chaslay.com`
- Shared staging helpers already on StagingChaslay: `build-bridge-apk.yml`, `staging-api-auto-heal.yml`, `staging-health-watch.yml`

## What must never be copied from rebornSense

RebornSense-only workflows (including `check-migrations.yml`, `sync-staging-chaslay.yml`, production/deploy-rebornsense jobs) are stripped in the sync workflow before push.

To change workflow YAML on StagingChaslay, edit that repo directly or use a PAT with **Contents + Workflows** write; see `DEPLOY.md` § StagingChaslay sync.
