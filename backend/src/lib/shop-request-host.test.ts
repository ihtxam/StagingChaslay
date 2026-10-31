import { describe, expect, it } from "vitest";
import {
  isShopPathHubHost,
  isShopRequestHost,
  requestLooksLikeSpaDocument,
  shopSlugFromPath,
} from "./shop-request-host";

describe("shop-request-host", () => {
  it("detects shop path hub hosts", () => {
    expect(isShopPathHubHost("order.rebornsense.com")).toBe(true);
    expect(isShopPathHubHost("shop.chaslay.com")).toBe(true);
    expect(isShopPathHubHost("app.rebornsense.com")).toBe(false);
  });

  it("extracts slug from path hub URLs", () => {
    expect(shopSlugFromPath("/brazza-pizza/menu")).toBe("brazza-pizza");
    expect(shopSlugFromPath("/api/shop/demo")).toBeNull();
  });

  it("treats extension-less shop paths as SPA documents", () => {
    expect(requestLooksLikeSpaDocument("/demo", "application/json")).toBe(true);
    expect(requestLooksLikeSpaDocument("/demo/menu", "")).toBe(true);
    expect(requestLooksLikeSpaDocument("/demo/menu.js", "")).toBe(false);
  });

  it("treats custom domains as shop hosts", () => {
    expect(
      isShopRequestHost({
        host: "www.brazzapizza.ch",
      })
    ).toBe(true);
    expect(
      isShopRequestHost({
        host: "app.rebornsense.com",
      })
    ).toBe(false);
  });
});
