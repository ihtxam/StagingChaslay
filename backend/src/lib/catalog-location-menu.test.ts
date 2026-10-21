import { describe, expect, it } from "vitest";
import { CatalogLocationService } from "@/services/catalog-location.service";

describe("catalog location menu filter", () => {
  it("filterByHqMenuProductIds returns all products when menu selection is open", () => {
    const products = [{ id: "a" }, { id: "b" }];
    expect(CatalogLocationService.filterByHqMenuProductIds(products, null)).toEqual(products);
  });

  it("filterByHqMenuProductIds returns none when menu explicitly empty", () => {
    const products = [{ id: "a" }, { id: "b" }];
    expect(CatalogLocationService.filterByHqMenuProductIds(products, new Set())).toEqual([]);
  });
});
