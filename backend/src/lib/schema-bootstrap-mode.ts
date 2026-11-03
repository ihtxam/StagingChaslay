/**
 * How aggressively the API applies merchant DDL at runtime.
 *
 * - full (default): background ensureAllMerchantSchema on boot + proactive location patches.
 * - lazy: no boot-time full pass; DDL only via deploy migrate/schema-repair and
 *   withMerchantSchemaRetry / patchMerchantSchemaFromError on real DB errors.
 */

export type MerchantSchemaBootstrapMode = "full" | "lazy";

function normalize(raw: string | undefined): MerchantSchemaBootstrapMode {
  const v = String(raw || "full").trim().toLowerCase();
  if (v === "lazy" || v === "migrate_only" || v === "migrate-only" || v === "error_only") {
    return "lazy";
  }
  return "full";
}

export function getMerchantSchemaBootstrapMode(): MerchantSchemaBootstrapMode {
  return normalize(process.env.MERCHANT_SCHEMA_BOOTSTRAP);
}

export function isLazyMerchantSchemaBootstrap(): boolean {
  return getMerchantSchemaBootstrapMode() === "lazy";
}
