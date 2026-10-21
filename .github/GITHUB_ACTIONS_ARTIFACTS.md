# GitHub Actions artifact storage

## Root cause of `Artifact storage quota has been hit`

GitHub stores **workflow artifacts** (from `actions/upload-artifact`) in your account/org quota. Large APK/NSIS builds with **`retention-days: 90`** accumulate quickly. Hitting the cap blocks **all new uploads**, including unrelated workflows.

**Self-hosted runners do not fix this** unless you stop uploading artifacts. Runners only replace GitHub-hosted **compute minutes** and **concurrency**; artifact bytes still count toward GitHub storage when you use `upload-artifact`.

## What this repo does now

| Workflow | Artifacts | Delivery |
|----------|-----------|----------|
| `build-bridge-apk.yml` | None | SCP to production downloads |
| `build-chaslay-pos-apk.yml` | None | SCP to production downloads |
| `build-chaslay-pos-windows.yml` | None | SCP from Windows runner to production |
| Deploy / sync / recovery | None | SSH only |

## Immediate unblock (ops)

1. **Delete old artifacts** (fastest):
   - GitHub → **ihtxam/rebornSense** → **Actions** → **Artifacts** → delete stale entries.
   - Or API (repo admin, `gh auth login`):

```bash
# List artifact IDs (paginate with --paginate)
gh api repos/ihtxam/rebornSense/actions/artifacts --paginate \
  -q '.artifacts[] | "\(.id)\t\(.name)\t\(.size_in_bytes)\t\(.created_at)"'

# Delete one artifact by id
gh api -X DELETE repos/ihtxam/rebornSense/actions/artifacts/ARTIFACT_ID
```

2. **Raise quota**: GitHub **Settings → Billing → Plans and usage → Actions** (paid storage/minutes) if you still want long-lived artifacts.

3. **Re-run** the failed workflow after space is freed.

## Optional cleanup workflow

**Actions → Cleanup GitHub Actions artifacts** (`cleanup-github-artifacts.yml`) deletes artifacts older than N days (default 7). Run manually when quota is tight.

## Self-hosted runner (Hetzner / `production-reborn`)

See [SELF_HOSTED_RUNNER_HETZNER.md](./SELF_HOSTED_RUNNER_HETZNER.md). Recommended labels: `self-hosted`, `linux`, `reborn` (or `hetzner`).

Use self-hosted for:

- Heavy Android builds (disk, cached SDK)
- Avoiding GitHub **minutes** limits

Do **not** expect self-hosted alone to fix artifact quota if workflows still call `upload-artifact`.

### Security

- Runners execute workflow code from the repo; restrict who can change workflows and use **environments** for production deploy secrets.
- Avoid running org/repo runners on **untrusted fork PRs** (Settings → Actions → Fork pull request workflows).
- Prefer a dedicated `github-runner` user, not shared root shells.
