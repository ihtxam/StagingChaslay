"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopSpaService = void 0;
const merchant_settings_service_1 = require("@/services/merchant-settings.service");
const chaslay_pagebuilder_service_1 = require("@/services/chaslay-pagebuilder.service");
const custom_domain_lookup_1 = require("@/lib/custom-domain-lookup");
const shop_spa_html_1 = require("@/lib/shop-spa-html");
const shop_spa_index_1 = require("@/lib/shop-spa-index");
const public_url_1 = require("@/lib/public-url");
const shop_site_settings_1 = require("@/lib/shop-site-settings");
const shop_request_host_1 = require("@/lib/shop-request-host");
function publicShopSite(req, merchant) {
    const site = (0, shop_site_settings_1.normalizeShopSiteSettings)(merchant.shopSiteSettings);
    return {
        ...site,
        faviconUrl: site.faviconUrl
            ? (0, public_url_1.resolvePublicAssetUrl)(req, site.faviconUrl) || site.faviconUrl
            : null,
    };
}
async function resolveMerchantForSpa(req) {
    if (req.shopMerchantFromHost)
        return req.shopMerchantFromHost;
    const host = (0, shop_request_host_1.hostFromRequest)(req.headers);
    const byCustom = await (0, custom_domain_lookup_1.findMerchantByCustomDomainHost)(host);
    if (byCustom)
        return byCustom;
    if ((0, shop_request_host_1.isShopPathHubHost)(host)) {
        const slug = (0, shop_request_host_1.shopSlugFromPath)(req.path);
        if (slug)
            return merchant_settings_service_1.MerchantSettingsService.resolveByShopHost(slug);
        return null;
    }
    return merchant_settings_service_1.MerchantSettingsService.resolveByShopHost(host);
}
function requestCanonicalUrl(req) {
    const host = (0, shop_request_host_1.hostFromRequest)(req.headers);
    const proto = String(req.headers["x-forwarded-proto"] || "https")
        .split(",")[0]
        ?.trim() || "https";
    const uri = String(req.originalUrl || req.url || "/").split("?")[0] || "/";
    return `${proto}://${host}${uri}`;
}
class ShopSpaService {
    static clearCache() {
        (0, shop_spa_index_1.clearShopSpaIndexCache)();
    }
    static async renderShell(req) {
        let html = await (0, shop_spa_index_1.loadShopSpaIndexHtml)();
        if (!html) {
            html =
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shop</title></head><body><div id="root"></div></body></html>';
        }
        const merchant = await resolveMerchantForSpa(req);
        if (!merchant?.shopEnabled)
            return html;
        const lang = String(merchant.shopLanguage || merchant.panelLanguage || "en");
        let fallbackTitle = merchant.name;
        let fallbackDescription = "";
        if (merchant.cmsHomepageEnabled) {
            try {
                const chaslay = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.getActive(merchant.id);
                if (chaslay?.name)
                    fallbackTitle = chaslay.name;
            }
            catch {
                /* optional */
            }
        }
        const site = publicShopSite(req, merchant);
        const resolved = (0, shop_site_settings_1.resolveShopDocumentSeo)(site, lang, {
            title: fallbackTitle,
            description: fallbackDescription,
        });
        const imageUrl = site.faviconUrl ||
            (0, public_url_1.resolvePublicAssetUrl)(req, merchant.shopBannerUrl) ||
            (0, public_url_1.resolvePublicAssetUrl)(req, merchant.shopLogoUrl);
        const seo = {
            title: resolved.title || merchant.name,
            description: resolved.description || merchant.name,
            url: requestCanonicalUrl(req),
            siteName: merchant.name,
            imageUrl,
            locale: lang.slice(0, 2),
        };
        return (0, shop_spa_html_1.injectShopSocialSeo)(html, seo);
    }
}
exports.ShopSpaService = ShopSpaService;
//# sourceMappingURL=shop-spa.service.js.map