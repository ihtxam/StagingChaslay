import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { AuthService } from "@/services/auth.service";
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
  passwordReset: boolean;
  panelNavCleared: boolean;
};

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
  const panelNavCleared = await healDemoPanelNavSettings(merchantId);

  return {
    merchantId,
    slug: merchant.slug,
    email: canonicalEmail,
    staffDeactivated,
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
