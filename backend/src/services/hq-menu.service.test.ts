import { describe, expect, it } from "vitest";

/** Mirrors hq-menu.service selection parsing. */
function readMenuSelection(input: {
  productIds?: unknown;
  product_ids?: unknown;
  categoryIds?: unknown;
  category_ids?: unknown;
}) {
  const stringArray = (raw: unknown) =>
    Array.isArray(raw) ? raw.map((x) => String(x || "").trim()).filter(Boolean) : [];
  return {
    productIds: stringArray(input.productIds ?? input.product_ids),
    categoryIds: stringArray(input.categoryIds ?? input.category_ids),
  };
}

describe("HQ menu selection payload", () => {
  it("accepts camelCase and snake_case", () => {
    expect(
      readMenuSelection({
        product_ids: ["p1"],
        category_ids: ["c1", "c2"],
      })
    ).toEqual({ productIds: ["p1"], categoryIds: ["c1", "c2"] });
  });

  it("prefers explicit camelCase when both sent", () => {
    expect(
      readMenuSelection({
        productIds: ["a"],
        product_ids: ["b"],
        categoryIds: ["x"],
        category_ids: ["y"],
      })
    ).toEqual({ productIds: ["a"], categoryIds: ["x"] });
  });
});
