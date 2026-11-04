import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type TerminalConflictMerchant = {
  id: string;
  name: string;
  slug: string | null;
  supportCode: string | null;
};

export function formatTerminalRegisteredToAnotherMerchantMessage(
  owner: Pick<TerminalConflictMerchant, "name" | "slug" | "supportCode">
): string {
  const label = owner.name?.trim() || "Unknown merchant";
  const extras: string[] = [];
  if (owner.slug?.trim()) extras.push(owner.slug.trim());
  if (owner.supportCode?.trim()) extras.push(owner.supportCode.trim());
  const suffix = extras.length ? ` (${extras.join(", ")})` : "";
  return `Terminal ID is already registered to merchant "${label}"${suffix}`;
}

export async function buildTerminalDuplicateConflictResponse(
  ownerMerchantId: string
): Promise<{ error: string; registeredToMerchant: TerminalConflictMerchant }> {
  const db = getDb();
  const owner = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, ownerMerchantId),
    columns: { id: true, name: true, slug: true, supportCode: true },
  });
  const registeredToMerchant: TerminalConflictMerchant = owner
    ? {
        id: owner.id,
        name: owner.name,
        slug: owner.slug,
        supportCode: owner.supportCode,
      }
    : {
        id: ownerMerchantId,
        name: "Unknown merchant",
        slug: null,
        supportCode: null,
      };
  return {
    error: formatTerminalRegisteredToAnotherMerchantMessage(registeredToMerchant),
    registeredToMerchant,
  };
}
