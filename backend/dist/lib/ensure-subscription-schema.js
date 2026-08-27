"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSubscriptionSchemaAtStartup = ensureSubscriptionSchemaAtStartup;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const SUBSCRIPTION_PLAN_COLUMN_PATCHES = {
    subscription_plans_owner_type: "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS owner_type varchar(20) NOT NULL DEFAULT 'platform'",
    subscription_plans_owner_id: "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS owner_id uuid",
    subscription_plans_edition_id: "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS edition_id uuid",
    subscription_plans_max_pos_posts: "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_pos_posts integer NOT NULL DEFAULT 0",
    subscription_plans_max_waiter_posts: "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_waiter_posts integer NOT NULL DEFAULT 0",
    subscription_plans_max_staff: "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_staff integer NOT NULL DEFAULT 0",
    subscription_plans_included_addons: "ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS included_addons jsonb DEFAULT '{}'",
};
const TABLE_PATCHES = [
    `CREATE TABLE IF NOT EXISTS subscription_addons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type varchar(20) NOT NULL DEFAULT 'platform',
    owner_id uuid,
    slug varchar(50) NOT NULL,
    name varchar(100) NOT NULL,
    description text,
    addon_key varchar(40) NOT NULL,
    price_monthly numeric(10,2) NOT NULL DEFAULT 0,
    price_yearly numeric(10,2),
    currency varchar(3) NOT NULL DEFAULT 'CHF',
    quantity integer NOT NULL DEFAULT 1,
    is_active boolean NOT NULL DEFAULT true,
    is_public boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS subscription_addons_slug_owner_idx
    ON subscription_addons (slug, owner_type, COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid))`,
    `CREATE TABLE IF NOT EXISTS merchant_addon_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    addon_id uuid NOT NULL REFERENCES subscription_addons(id) ON DELETE RESTRICT,
    billing_cycle varchar(20) NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'active',
    period_start timestamp,
    period_end timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS merchant_addon_subscriptions_merchant_idx
    ON merchant_addon_subscriptions (merchant_id)`,
    `CREATE TABLE IF NOT EXISTS subscription_addon_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    addon_id uuid NOT NULL REFERENCES subscription_addons(id) ON DELETE RESTRICT,
    billing_cycle varchar(20) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency varchar(3) NOT NULL DEFAULT 'CHF',
    status varchar(30) NOT NULL DEFAULT 'pending',
    adyen_session_id varchar(255),
    adyen_psp_reference varchar(255),
    adyen_recurring_detail_reference varchar(255),
    is_recurring boolean NOT NULL DEFAULT false,
    adyen_result_code varchar(50),
    paid_at timestamp,
    period_start timestamp,
    period_end timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
    `CREATE INDEX IF NOT EXISTS subscription_addon_payments_merchant_id_idx
    ON subscription_addon_payments (merchant_id)`,
];
let startupPatchPromise = null;
async function runPlanPatch(key) {
    const stmt = SUBSCRIPTION_PLAN_COLUMN_PATCHES[key];
    if (!stmt)
        return;
    const db = (0, db_1.getDb)();
    await db.execute(drizzle_orm_1.sql.raw(stmt));
}
async function ensureSubscriptionTables() {
    const db = (0, db_1.getDb)();
    for (const stmt of TABLE_PATCHES) {
        await db.execute(drizzle_orm_1.sql.raw(stmt));
    }
}
function ensureSubscriptionSchemaAtStartup() {
    if (startupPatchPromise)
        return;
    startupPatchPromise = (async () => {
        for (const key of Object.keys(SUBSCRIPTION_PLAN_COLUMN_PATCHES)) {
            await runPlanPatch(key);
        }
        await ensureSubscriptionTables();
    })().catch((err) => {
        console.warn("[schema] subscription startup patch failed:", err);
    });
}
//# sourceMappingURL=ensure-subscription-schema.js.map