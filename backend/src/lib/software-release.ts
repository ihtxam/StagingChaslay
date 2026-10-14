export const SOFTWARE_RELEASE_PRODUCTS = ["all", "platform", "desktop", "android"] as const;
export type SoftwareReleaseProduct = (typeof SOFTWARE_RELEASE_PRODUCTS)[number];

export type SoftwareReleaseInput = {
  version?: string | null;
  title?: string | null;
  body?: string | null;
  product?: string | null;
  isPublished?: boolean | null;
  publishedAt?: string | Date | null;
};

export function normalizeSoftwareReleaseVersion(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .replace(/^v/i, "")
    .slice(0, 40);
}

export function normalizeSoftwareReleaseProduct(raw: string | null | undefined): SoftwareReleaseProduct {
  const value = String(raw || "all").trim().toLowerCase();
  return (SOFTWARE_RELEASE_PRODUCTS as readonly string[]).includes(value)
    ? (value as SoftwareReleaseProduct)
    : "all";
}

export function parseSoftwareReleaseInput(input: SoftwareReleaseInput, requireVersion = false) {
  const version = normalizeSoftwareReleaseVersion(input.version);
  if (requireVersion && !version) {
    throw new Error("Version is required (for example 1.4.2)");
  }
  const title = String(input.title || "").trim().slice(0, 255);
  if (requireVersion && !title) {
    throw new Error("Title is required");
  }
  return {
    version: version || undefined,
    title: title || undefined,
    body: input.body === undefined ? undefined : String(input.body || "").slice(0, 8000),
    product: input.product === undefined ? undefined : normalizeSoftwareReleaseProduct(input.product),
    isPublished: input.isPublished === undefined ? undefined : input.isPublished !== false,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined,
  };
}
