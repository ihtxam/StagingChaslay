import type { Request } from "express";
import { MerchantSettingsService } from "@/services/merchant-settings.service";
import { ChaslayPagebuilderService } from "@/services/chaslay-pagebuilder.service";
import { findMerchantByCustomDomainHost } from "@/lib/custom-domain-lookup";
import { injectShopSocialSeo, type ShopSocialSeo } from "@/lib/shop-spa-html";
import { clearShopSpaIndexCache, loadShopSpaIndexHtml } from "@/lib/shop-spa-index";
import { resolvePublicAssetUrl } from "@/lib/public-url";
import { resolveShopDocumentSeo, normalizeShopSiteSettings } from "@/lib/shop-site-settings";
import {
  hostFromRequest,
  isShopPathHubHost,
  shopSlugFromPath,
} from "@/lib/shop-request-host";

function publicShopSite(req: Request, merchant: { shopSiteSettings?: unknown }) {
  const site = normalizeShopSiteSettings(merchant.shopSiteSettings);
  return {
    ...site,
    faviconUrl: site.faviconUrl
      ? resolvePublicAssetUrl(req, site.faviconUrl) || site.faviconUrl
      : null,
  };
}

async function resolveMerchantForSpa(req: Request) {
  if (req.shopMerchantFromHost) return req.shopMerchantFromHost;

  const host = hostFromRequest(req.headers);
  const byCustom = await findMerchantByCustomDomainHost(host);
  if (byCustom) return byCustom;

  if (isShopPathHubHost(host)) {
    const slug = shopSlugFromPath(req.path);
    if (slug) return MerchantSettingsService.resolveByShopHost(slug);
    return null;
  }

  return MerchantSettingsService.resolveByShopHost(host);
}

function requestCanonicalUrl(req: Request): string {
  const host = hostFromRequest(req.headers);
  const proto =
    String(req.headers["x-forwarded-proto"] || "https")
      .split(",")[0]
      ?.trim() || "https";
  const uri = String(req.originalUrl || req.url || "/").split("?")[0] || "/";
  return `${proto}://${host}${uri}`;
}

export class ShopSpaService {
  static clearCache() {
    clearShopSpaIndexCache();
  }

  static async renderShell(req: Request): Promise<string | null> {
    const html = await loadShopSpaIndexHtml();
    if (!html) return null;

    const merchant = await resolveMerchantForSpa(req);
    if (!merchant?.shopEnabled) return html;

    const lang = String(merchant.shopLanguage || merchant.panelLanguage || "en");
    let fallbackTitle = merchant.name;
    let fallbackDescription = "";

    if (merchant.cmsHomepageEnabled) {
      try {
        const chaslay = await ChaslayPagebuilderService.getActive(merchant.id);
        if (chaslay?.name) fallbackTitle = chaslay.name;
      } catch {
        /* optional */
      }
    }

    const site = publicShopSite(req, merchant);
    const resolved = resolveShopDocumentSeo(site, lang, {
      title: fallbackTitle,
      description: fallbackDescription,
    });

    const imageUrl =
      site.faviconUrl ||
      resolvePublicAssetUrl(req, merchant.shopBannerUrl) ||
      resolvePublicAssetUrl(req, merchant.shopLogoUrl);

    const seo: ShopSocialSeo = {
      title: resolved.title || merchant.name,
      description: resolved.description || merchant.name,
      url: requestCanonicalUrl(req),
      siteName: merchant.name,
      imageUrl,
      locale: lang.slice(0, 2),
    };

    return injectShopSocialSeo(html, seo);
  }
}
