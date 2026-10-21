import { describe, expect, it } from "vitest";
import {
  collectPendingProductIds,
  hasNeverSynced,
  productPendingForLocation,
  resolveSyncProductIds,
} from "@/lib/hq-catalog-sync";

describe("hq-catalog-sync helpers", () => {
  const products = [
    { id: "p1", categoryId: "c1", updatedAtMs: 100 },
    { id: "p2", categoryId: "c1", updatedAtMs: 200 },
    { id: "p3", categoryId: "c2", updatedAtMs: 50 },
  ];

  it("resolves product ids by category", () => {
    expect(resolveSyncProductIds(products, [], ["c1"])).toEqual(["p1", "p2"]);
    expect(resolveSyncProductIds(products, ["p3"], [])).toEqual(["p3"]);
    expect(resolveSyncProductIds(products, [], [])).toEqual(["p1", "p2", "p3"]);
  });

  it("detects pending when branch uses links and product is missing", () => {
    expect(productPendingForLocation(products[0], undefined, true)).toBe(true);
    expect(productPendingForLocation(products[0], undefined, false)).toBe(false);
  });

  it("detects pending when HQ product changed after link", () => {
    const link = { hqProductId: "p1", localProductId: "p1", updatedAtMs: 50 };
    expect(productPendingForLocation(products[0], link, true)).toBe(true);
    const fresh = { ...link, updatedAtMs: 150 };
    expect(productPendingForLocation(products[0], fresh, true)).toBe(false);
  });

  it("collects pending ids across locations", () => {
    const linksByLocation = new Map([
      [
        "loc1",
        [{ hqProductId: "p1", localProductId: "p1", updatedAtMs: 50 }] as const,
      ],
    ]);
    const locations = [{ id: "loc1", name: "Kiosk", linkCount: 1 }];
    const pending = collectPendingProductIds(products, linksByLocation, locations);
    expect(pending).toContain("p1");
    expect(pending).toContain("p2");
  });

  it("never synced when every branch has zero catalog links", () => {
    expect(
      hasNeverSynced([
        { id: "a", name: "Bar", linkCount: 0 },
        { id: "b", name: "Kiosk", linkCount: 0 },
      ])
    ).toBe(true);
    expect(
      hasNeverSynced([
        { id: "a", name: "Bar", linkCount: 3 },
        { id: "b", name: "Kiosk", linkCount: 0 },
      ])
    ).toBe(false);
  });
});
