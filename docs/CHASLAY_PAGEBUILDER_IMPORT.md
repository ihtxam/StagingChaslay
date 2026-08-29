# Chaslay Page Builder Import (beta)

Experimental import of the **Craft.js homepage builder** from [Chaslay](https://github.com/ihtxam/Chaslay) into rebornSense. It runs **in parallel** with the existing **OpenPage** website CMS (`/merchant/website`) and does not replace it.

## Merchant panel URLs

| Page | Path |
|------|------|
| Homepage list + templates | `/merchant/chaslay-page-builder` |
| Full-screen editor | `/merchant/chaslay-page-builder/edit?id=<builderId>` |

Navigation: **CMS → Chaslay Page Builder (beta)**

## API (rebornSense backend)

Base path: `/api/merchant/chaslay-pagebuilder`

Mirrors Chaslay Laravel `HomepageBuilderController` + `HomepageBuilderPageController`:

- `GET /` — list builders
- `GET /active` — active builder
- `GET /:id` — single builder + `editor_state`
- `POST /` — create
- `PUT /:id` — update name / editor_state
- `DELETE /:id`
- `POST /:id/activate` / `POST /:id/deactivate`
- `GET /:builderId/pages` — multi-page support
- `POST|PUT|DELETE /:builderId/pages/:pageId`

Catalog for menu blocks reuses existing `GET /api/merchant/cms/catalog`.

## Database

New tables (auto-created via `ensure-merchant-schema` on startup):

- `chaslay_homepage_builders`
- `chaslay_homepage_builder_pages`

## Files copied from Chaslay

Source repo path → rebornSense path:

### Editor module (Craft.js)

- `pos-admin/src/components/homepage-builder/**` → `dashboard/src/chaslay-pagebuilder/**` (~80 files)
- `pos-admin/src/types/homepage-builder.ts` → `dashboard/src/chaslay-pagebuilder/types/homepage-builder.ts`
- `pos-admin/src/data/templates/**` → `dashboard/src/chaslay-pagebuilder/data/templates/**`

### Shadcn UI (minimal set for property panels)

- `pos-admin/src/components/ui/{button,input,textarea,label,select,slider,switch,dialog,alert-dialog,card,badge,skeleton,scroll-area}.tsx` → `dashboard/src/chaslay-pagebuilder/ui/`

### New rebornSense integration (not from Chaslay)

- `backend/src/routes/chaslay-pagebuilder.routes.ts`
- `backend/src/services/chaslay-pagebuilder.service.ts`
- `backend/src/db/schema.ts` (chaslay_* tables)
- `backend/src/lib/ensure-merchant-schema.ts` (CREATE TABLE IF NOT EXISTS)
- `dashboard/src/lib/chaslay-pagebuilder/{api,utils,i18n-stub}.ts`
- `dashboard/src/pages/merchant/ChaslayPageBuilder{List,Editor}.tsx`
- `dashboard/src/chaslay-pagebuilder/chaslay-pagebuilder.css`
- `dashboard/src/chaslay-pagebuilder/menu-types.ts`

## Adaptations

- `@/` imports remapped to `@/chaslay-pagebuilder/` and `@/lib/chaslay-pagebuilder/`
- `next/link` → `react-router-dom` `Link`
- `next/image` → `<img>`
- `sonner` → `react-hot-toast`
- `useTranslations` → minimal English stub (`i18n-stub.ts`)
- Menu catalog via rebornSense `/merchant/cms/catalog` (UUID product IDs; `featuredProductIds` uses strings)
- `// @ts-nocheck` on copied Chaslay TSX (strict-mode cleanup deferred)

## Not copied / not wired (yet)

- Chaslay **storefront** renderer (`storefront/components/homepage-renderer/`) — shop visitors still use OpenPage CMS homepage
- Activating a Chaslay builder does **not** replace the public shop homepage (editor + save only for now)
- Chaslay Laravel `feature_homepage_builder` business flag
- POS, orders, auth, mobile, back-api unrelated modules

## How to test

1. Deploy or run backend + dashboard with this branch.
2. Log in as merchant with **Manage online shop** permission.
3. Open `/merchant/chaslay-page-builder`.
4. Create a homepage (blank or template), open editor, drag blocks, save.
5. Confirm existing `/merchant/website` (OpenPage) still works.

## How to revert

```bash
# Drop the branch locally
git checkout main
git branch -D cursor/chaslay-pagebuilder-import-8f5f

# Or revert the merge commit on main after merge
git revert -m 1 <merge-commit-sha>

# Optional: drop DB tables (only if you want to remove saved test data)
# DROP TABLE chaslay_homepage_builder_pages;
# DROP TABLE chaslay_homepage_builders;
```

## Build status

- `dashboard`: `npm run build` — **passes** (Vite)
- `backend`: pre-existing `tsc` errors in unrelated services; new pagebuilder routes compile with the rest of the app at runtime

## Branch

`cursor/chaslay-pagebuilder-import-8f5f`
