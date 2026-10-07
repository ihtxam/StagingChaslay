"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shop_spa_html_1 = require("./shop-spa-html");
(0, vitest_1.describe)("shop-spa-html", () => {
    (0, vitest_1.it)("builds Open Graph and Twitter tags from SEO payload", () => {
        const html = (0, shop_spa_html_1.buildShopSocialMetaTags)({
            title: "Brazza Pizza",
            description: "Authentic pizza in Pieterlen",
            url: "https://www.brazzapizza.ch/",
            siteName: "Brazza Pizza",
            imageUrl: "https://www.brazzapizza.ch/logo.png",
            locale: "de",
        });
        (0, vitest_1.expect)(html).toContain('property="og:title" content="Brazza Pizza"');
        (0, vitest_1.expect)(html).toContain('property="og:description" content="Authentic pizza in Pieterlen"');
        (0, vitest_1.expect)(html).toContain('property="og:url" content="https://www.brazzapizza.ch/"');
        (0, vitest_1.expect)(html).toContain('property="og:site_name" content="Brazza Pizza"');
        (0, vitest_1.expect)(html).toContain('property="og:image" content="https://www.brazzapizza.ch/logo.png"');
        (0, vitest_1.expect)(html).toContain('name="twitter:card" content="summary_large_image"');
    });
    (0, vitest_1.it)("injects tags into the SPA shell", () => {
        const shell = `<!doctype html><html><head><title>Reborn</title><meta name="description" content="Reborn app" /></head><body></body></html>`;
        const out = (0, shop_spa_html_1.injectShopSocialSeo)(shell, {
            title: "Demo Café",
            description: "Order online",
            url: "https://order.rebornsense.com/demo",
            siteName: "Demo Café",
            imageUrl: null,
            locale: "en",
        });
        (0, vitest_1.expect)(out).toContain("<title>Demo Café</title>");
        (0, vitest_1.expect)(out).toContain('content="Order online"');
        (0, vitest_1.expect)(out).toContain('property="og:title" content="Demo Café"');
        (0, vitest_1.expect)(out).not.toContain("Reborn app");
    });
});
//# sourceMappingURL=shop-spa-html.test.js.map