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

  it("resolveLinkedProductIds heals stale localProductId via hqProductId", () => {
    const products = [{ id: "p1" }, { id: "p2" }];
    const links = [
      { hqProductId: "p1", localProductId: "deleted-old-id" },
      { hqProductId: "p2", localProductId: null },
    ];
    const allowed = CatalogLocationService.resolveLinkedProductIds(links, products);
    expect([...allowed].sort()).toEqual(["p1", "p2"]);
  });
});
