import { describe, expect, it } from "vitest";
import { buildShopSocialMetaTags, injectShopSocialSeo } from "./shop-spa-html";

describe("shop-spa-html", () => {
  it("builds Open Graph and Twitter tags from SEO payload", () => {
    const html = buildShopSocialMetaTags({
      title: "Brazza Pizza",
      description: "Authentic pizza in Pieterlen",
      url: "https://www.brazzapizza.ch/",
      siteName: "Brazza Pizza",
      imageUrl: "https://www.brazzapizza.ch/logo.png",
      locale: "de",
    });
    expect(html).toContain('property="og:title" content="Brazza Pizza"');
    expect(html).toContain('property="og:description" content="Authentic pizza in Pieterlen"');
    expect(html).toContain('property="og:url" content="https://www.brazzapizza.ch/"');
    expect(html).toContain('property="og:site_name" content="Brazza Pizza"');
    expect(html).toContain('property="og:image" content="https://www.brazzapizza.ch/logo.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("injects tags into the SPA shell", () => {
    const shell = `<!doctype html><html><head><title>Reborn</title><meta name="description" content="Reborn app" /></head><body></body></html>`;
    const out = injectShopSocialSeo(shell, {
      title: "Demo Café",
      description: "Order online",
      url: "https://order.rebornsense.com/demo",
      siteName: "Demo Café",
      imageUrl: null,
      locale: "en",
    });
    expect(out).toContain("<title>Demo Café</title>");
    expect(out).toContain('content="Order online"');
    expect(out).toContain('property="og:title" content="Demo Café"');
    expect(out).not.toContain("Reborn app");
  });
});
