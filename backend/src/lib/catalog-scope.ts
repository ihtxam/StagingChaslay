/** How multi-location merchants own menu rows (products / categories). */
export type CatalogScopeMode = "per_location" | "shared";

export function normalizeCatalogScopeMode(raw: unknown): CatalogScopeMode {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  if (v === "shared" || v === "hq" || v === "hq_push") return "shared";
  return "per_location";
}

export function catalogScopeModeLabel(mode: CatalogScopeMode): string {
  return mode === "shared" ? "shared" : "per_location";
}
