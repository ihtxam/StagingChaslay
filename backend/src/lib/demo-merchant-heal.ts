import { getDb, schema } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { AuthService } from "@/services/auth.service";
import { normalizeStaffLoginHome } from "@/lib/staff-login-home";
import {
  demoMerchantOwnerEmailAliases,
  demoMerchantSlugs,
  isDemoMerchantOwnerEmail,
} from "@/lib/demo-merchant-login";
import { normalizePanelNavHidden } from "@/lib/panel-nav-hidden";

export type DemoMerchantHealResult = {
  merchantId: string;
  slug: string | null;
  email: string;
  staffDeactivated: number;
  duplicatePinsCleared: number;
  passwordReset: boolean;
  panelNavCleared: boolean;
};

/** True when merchant slug is the seeded walkthrough shop (demo / polacafe). */
export async function isDemoShowcaseMerchantId(merchantId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: { slug: true },
  });
  if (!row?.slug) return false;
  const slugKey = String(row.slug).trim().toLowerCase();
  return demoMerchantSlugs().includes(slugKey);
}

/** Resolve the showcase merchant row for demo owner login (prod PolaCafe + staging demo slug). */
export async function resolveDemoShowcaseMerchantId(): Promise<string | null> {
  const db = getDb();
  const slugs = demoMerchantSlugs();
  for (const slug of slugs) {
    const row = await db.query.merchants.findFirst({
      where: eq(schema.merchants.slug, slug),
      columns: { id: true },
    });
    if (row?.id) return row.id;
  }
  const canonical = (process.env.SEED_DEMO_MERCHANT_EMAIL || "demo@rebornsense.com")
    .trim()
    .toLowerCase();
  const byEmail = await db.query.merchants.findFirst({
    where: eq(schema.merchants.email, canonical),
    columns: { id: true },
  });
  return byEmail?.id ?? null;
}

export async function healDemoPanelNavSettings(merchantId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: { panelNavHidden: true },
  });
  if (!row) return false;
  const hidden = normalizePanelNavHidden(row.panelNavHidden);
  if (!hidden.includes("/merchant/settings")) return false;
  const next = hidden.filter((key) => key !== "/merchant/settings");
  await db
    .update(schema.merchants)
    .set({
      panelNavHidden: next.length ? next : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.merchants.id, merchantId));
  return true;
}

/**
 * Owner email login must win over staff rows sharing demo@chaslay.com / demo@rebornsense.com.
 */
export async function healDemoOwnerLogin(
  merchantId: string,
  canonicalEmail: string
): Promise<number> {
  const db = getDb();
  const aliases = demoMerchantOwnerEmailAliases();
  const normalizedCanonical = String(canonicalEmail || "").trim().toLowerCase();
  if (!normalizedCanonical) return 0;

  await db
    .update(schema.merchants)
    .set({
      email: normalizedCanonical,
      updatedAt: new Date(),
    })
    .where(eq(schema.merchants.id, merchantId));

  const staffRows = await db.query.merchantStaff.findMany({
    where: eq(schema.merchantStaff.merchantId, merchantId),
    columns: { id: true, email: true, isActive: true },
  });
  let deactivated = 0;
  for (const row of staffRows) {
    const staffEmail = String(row.email || "")
      .trim()
      .toLowerCase();
    if (!staffEmail || !aliases.includes(staffEmail)) continue;
    if (!row.isActive) continue;
    await db
      .update(schema.merchantStaff)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.merchantStaff.id, row.id));
    deactivated += 1;
  }
  return deactivated;
}

/**
 * Walkthrough PIN 0000 must unlock the Manager (full settings gear), not a floor waiter
 * who still shares the default PIN on production demo data.
 */
export async function healDemoExclusiveManagerPin(merchantId: string): Promise<number> {
  if (!(await isDemoShowcaseMerchantId(merchantId))) return 0;

  const { StaffService, DEFAULT_MANAGER_PIN } = await import("@/services/staff.service");
  const db = getDb();

  await StaffService.ensureDefaultRoles(merchantId);
  await StaffService.ensureDefaultManagerStaff(merchantId, "Manager");

  const managerRole = await db.query.merchantRoles.findFirst({
    where: and(
      eq(schema.merchantRoles.merchantId, merchantId),
      sql`lower(trim(${schema.merchantRoles.name})) = 'manager'`
    ),
  });
  if (!managerRole) return 0;

  const staffRows = await db.query.merchantStaff.findMany({
    where: and(
      eq(schema.merchantStaff.merchantId, merchantId),
      eq(schema.merchantStaff.isActive, true)
    ),
  });
  const managerStaff = staffRows.find((row) => row.roleId === managerRole.id);
  if (!managerStaff) return 0;

  let cleared = 0;
  for (const staff of staffRows) {
    if (staff.id === managerStaff.id || !staff.pinHash) continue;
    const sharesDefault = await AuthService.comparePassword(
      DEFAULT_MANAGER_PIN,
      staff.pinHash
    );
    if (!sharesDefault) continue;
    await db
      .update(schema.merchantStaff)
      .set({ pinHash: null, pinDisplay: null, updatedAt: new Date() })
      .where(eq(schema.merchantStaff.id, staff.id));
    cleared += 1;
  }

  const managerHasDefault =
    !!managerStaff.pinHash &&
    (await AuthService.comparePassword(DEFAULT_MANAGER_PIN, managerStaff.pinHash));
  if (!managerHasDefault) {
    const pinHash = await AuthService.hashPassword(DEFAULT_MANAGER_PIN);
    await db
      .update(schema.merchantStaff)
      .set({
        pinHash,
        pinDisplay: DEFAULT_MANAGER_PIN,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchantStaff.id, managerStaff.id));
  }

  if (normalizeStaffLoginHome(managerStaff.loginHome) !== "panel") {
    await db
      .update(schema.merchantStaff)
      .set({ loginHome: "panel", updatedAt: new Date() })
      .where(eq(schema.merchantStaff.id, managerStaff.id));
  }

  return cleared;
}

/** Called before PIN verify on showcase merchants so 0000 resolves to Manager. */
export async function ensureDemoPinUnlockReady(merchantId: string): Promise<void> {
  if (!(await isDemoShowcaseMerchantId(merchantId))) return;
  await healDemoExclusiveManagerPin(merchantId);
}

export async function healDemoMerchantLogin(opts?: {
  merchantId?: string;
  resetPassword?: boolean;
}): Promise<DemoMerchantHealResult | null> {
  const merchantId = opts?.merchantId ?? (await resolveDemoShowcaseMerchantId());
  if (!merchantId) return null;

  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: { id: true, email: true, slug: true },
  });
  if (!merchant) return null;

  const canonicalEmail = (process.env.SEED_DEMO_MERCHANT_EMAIL || "demo@rebornsense.com")
    .trim()
    .toLowerCase();
  const demoSlugs = demoMerchantSlugs();
  const slugKey = String(merchant.slug || "")
    .trim()
    .toLowerCase();
  const shouldResetPassword =
    opts?.resetPassword ??
    (process.env.SEED_DEMO_RESET_PASSWORD !== "false" &&
      (String(merchant.email || "").toLowerCase() === canonicalEmail ||
        demoSlugs.includes(slugKey)));

  let passwordReset = false;
  if (shouldResetPassword) {
    const password = process.env.SEED_DEMO_MERCHANT_PASSWORD || "DemoShop123!";
    const passwordHash = await AuthService.hashPassword(password);
    await db
      .update(schema.merchants)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
    passwordReset = true;
  }

  const staffDeactivated = await healDemoOwnerLogin(merchantId, canonicalEmail);
  const duplicatePinsCleared = await healDemoExclusiveManagerPin(merchantId);
  const panelNavCleared = await healDemoPanelNavSettings(merchantId);

  return {
    merchantId,
    slug: merchant.slug,
    email: canonicalEmail,
    staffDeactivated,
    duplicatePinsCleared,
    passwordReset,
    panelNavCleared,
  };
}

/** Called on demo alias owner login so staff email rows cannot win on the next attempt. */
export async function ensureDemoOwnerLoginReady(email: string): Promise<void> {
  if (!isDemoMerchantOwnerEmail(email)) return;
  const merchantId = await resolveDemoShowcaseMerchantId();
  if (!merchantId) return;
  const canonicalEmail = (process.env.SEED_DEMO_MERCHANT_EMAIL || "demo@rebornsense.com")
    .trim()
    .toLowerCase();
  await healDemoOwnerLogin(merchantId, canonicalEmail);
}
