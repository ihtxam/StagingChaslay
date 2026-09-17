import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureGiftCardAddonColumn } from "@/lib/ensure-merchant-schema";

/** Paid gift cards addon — merchant-level. */
export function isGiftCardAddonEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (!result) return undefined;
  if (Array.isArray(result)) return result[0] as Record<string, unknown> | undefined;
  const r = result as { rows?: Record<string, unknown>[] };
  if (Array.isArray(r.rows)) return r.rows[0];
  return undefined;
}

function flagFromRow(row: Record<string, unknown> | undefined): boolean {
  if (!row) return false;
  return isGiftCardAddonEnabled(row.gift_card_addon_enabled ?? row.giftCardAddonEnabled);
}

export function editionIncludesGiftCards(features: string[] | null | undefined): boolean {
  if (!features) return false;
  return features.includes("gift_cards") || features.includes("pos_gift_cards");
}

/** License = paid addon column, edition feature, or legacy (null features). */
export function isGiftCardsLicensed(input: {
  giftCardAddonEnabled?: unknown;
  features?: string[] | null;
} | null | undefined): boolean {
  if (!input) return false;
  if (isGiftCardAddonEnabled(input.giftCardAddonEnabled)) return true;
  if (input.features == null) return true;
  return editionIncludesGiftCards(input.features);
}

export async function readGiftCardAddonEnabled(merchantId: string): Promise<boolean> {
  await ensureGiftCardAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT gift_card_addon_enabled FROM merchants WHERE id = ${merchantId} LIMIT 1`
  );
  const row = firstRow(result);
  if (!row) throw new Error("Merchant not found");
  return flagFromRow(row);
}

export async function writeGiftCardAddonEnabled(
  merchantId: string,
  enabled: boolean
): Promise<boolean> {
  await ensureGiftCardAddonColumn();
  const db = getDb();
  const on = isGiftCardAddonEnabled(enabled);
  await db.execute(
    sql`UPDATE merchants SET gift_card_addon_enabled = ${on}, updated_at = NOW() WHERE id = ${merchantId}`
  );
  try {
    const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
    EditionEntitlementsService.invalidate(merchantId);
  } catch {
    /* cache optional */
  }
  return readGiftCardAddonEnabled(merchantId);
}

export async function readGiftCardAddonEnabledMap(
  merchantIds: string[]
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  if (merchantIds.length === 0) return out;
  await ensureGiftCardAddonColumn();
  const db = getDb();
  const result = await db.execute(
    sql`SELECT id, gift_card_addon_enabled FROM merchants WHERE id IN (${sql.join(
      merchantIds.map((id) => sql`${id}`),
      sql`, `
    )})`
  );
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: Record<string, unknown>[] }).rows ?? []);
  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const id = String(row.id || "");
    if (id) out.set(id, flagFromRow(row));
  }
  return out;
}

export async function merchantHasGiftCardsLicense(merchantId: string): Promise<boolean> {
  const addon = await readGiftCardAddonEnabled(merchantId).catch(() => false);
  if (addon) return true;
  try {
    const { EditionEntitlementsService } = await import("@/services/edition-entitlements.service");
    const features = await EditionEntitlementsService.getFeatures(merchantId);
    return isGiftCardsLicensed({ giftCardAddonEnabled: false, features });
  } catch {
    return true;
  }
}
