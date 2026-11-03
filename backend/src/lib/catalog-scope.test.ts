import { describe, expect, it } from "vitest";
import { normalizeCatalogScopeMode } from "@/lib/catalog-scope";

describe("catalog scope mode", () => {
  it("defaults unknown values to per_location", () => {
    expect(normalizeCatalogScopeMode(undefined)).toBe("per_location");
    expect(normalizeCatalogScopeMode("")).toBe("per_location");
  });

  it("accepts shared aliases", () => {
    expect(normalizeCatalogScopeMode("shared")).toBe("shared");
    expect(normalizeCatalogScopeMode("hq_push")).toBe("shared");
  });
});
