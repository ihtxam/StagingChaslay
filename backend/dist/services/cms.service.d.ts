import { schema, type CmsTheme } from "@/db";
export type OpenPageBlock = {
    id: string;
    type: string;
    variant: string;
    props: Record<string, unknown>;
};
export type OpenPageSiteConfig = {
    name: string;
    blocks: OpenPageBlock[];
    pages?: Array<{
        id: string;
        name: string;
        path: string;
        blocks: OpenPageBlock[];
    }>;
    theme?: Record<string, unknown>;
};
export type CmsOpenPageData = {
    engine: "openpage";
    config: OpenPageSiteConfig;
    html: string;
    defaultLocale?: "en" | "fr" | "de";
    locales?: Partial<Record<"en" | "fr" | "de", {
        config: OpenPageSiteConfig;
        html: string;
    }>>;
};
export type CmsTemplateKey = "blank" | "restaurant" | "food_truck" | "cafe_classic" | "bistro_light";
export declare const CMS_TEMPLATES: Array<{
    key: CmsTemplateKey;
    name: string;
    description: string;
    data: (shopName: string) => CmsOpenPageData;
}>;
/** Accept OpenPage payloads; migrate legacy Puck/Chai into a starter OpenPage page. */
export declare function normalizeCmsBlocks(raw: unknown, fallbackTitle?: string): CmsOpenPageData;
/** @deprecated alias */
export declare const normalizePuckData: typeof normalizeCmsBlocks;
export declare class CmsService {
    static listTemplates(): {
        key: CmsTemplateKey;
        name: string;
        description: string;
    }[];
    static listPages(merchantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        slug: string;
        merchantId: string;
        title: string;
        isHomepage: boolean;
        templateKey: string | null;
        blocks: schema.CmsOpenPageData | schema.CmsPuckData | schema.CmsBlock[];
        theme: schema.CmsTheme | null;
        seoTitle: string | null;
        seoDescription: string | null;
        publishedAt: Date | null;
    }[]>;
    static getPage(merchantId: string, pageId: string): Promise<{
        blocks: CmsOpenPageData;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        slug: string;
        merchantId: string;
        title: string;
        isHomepage: boolean;
        templateKey: string | null;
        theme: schema.CmsTheme | null;
        seoTitle: string | null;
        seoDescription: string | null;
        publishedAt: Date | null;
    }>;
    static createPage(merchantId: string, input: {
        title: string;
        slug?: string;
        isHomepage?: boolean;
        templateKey?: CmsTemplateKey;
        blocks?: CmsOpenPageData | unknown;
        theme?: CmsTheme | null;
        seoTitle?: string;
        seoDescription?: string;
        status?: "draft" | "published";
    }): Promise<{
        blocks: CmsOpenPageData;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        slug: string;
        merchantId: string;
        title: string;
        isHomepage: boolean;
        templateKey: string | null;
        theme: schema.CmsTheme | null;
        seoTitle: string | null;
        seoDescription: string | null;
        publishedAt: Date | null;
    }>;
    static updatePage(merchantId: string, pageId: string, input: {
        title?: string;
        slug?: string;
        isHomepage?: boolean;
        blocks?: CmsOpenPageData | unknown;
        theme?: CmsTheme | null;
        seoTitle?: string | null;
        seoDescription?: string | null;
        status?: "draft" | "published";
        templateKey?: string | null;
    }): Promise<{
        blocks: CmsOpenPageData;
        id: string;
        merchantId: string;
        title: string;
        slug: string;
        isHomepage: boolean;
        status: string;
        templateKey: string | null;
        theme: schema.CmsTheme | null;
        seoTitle: string | null;
        seoDescription: string | null;
        publishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static deletePage(merchantId: string, pageId: string): Promise<{
        ok: boolean;
    }>;
    static getPublishedHomepage(merchantId: string): Promise<{
        blocks: CmsOpenPageData;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        slug: string;
        merchantId: string;
        title: string;
        isHomepage: boolean;
        templateKey: string | null;
        theme: schema.CmsTheme | null;
        seoTitle: string | null;
        seoDescription: string | null;
        publishedAt: Date | null;
    } | null>;
    static getPublishedBySlug(merchantId: string, slug: string): Promise<{
        blocks: CmsOpenPageData;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        slug: string;
        merchantId: string;
        title: string;
        isHomepage: boolean;
        templateKey: string | null;
        theme: schema.CmsTheme | null;
        seoTitle: string | null;
        seoDescription: string | null;
        publishedAt: Date | null;
    } | null>;
    static updateSiteSettings(merchantId: string, input: {
        customDomain?: string | null;
        cmsHomepageEnabled?: boolean;
    }): Promise<{
        customDomain: string | null;
        cmsHomepageEnabled: boolean;
        shopEnabled: boolean;
        slug: string | null;
        subdomain: string | null;
        name: string;
        shopCustomDomainUrl: string | null;
    }>;
    static getSiteSettings(merchantId: string): Promise<{
        customDomain: string | null;
        cmsHomepageEnabled: boolean;
        shopEnabled: boolean;
        slug: string | null;
        subdomain: string | null;
        name: string;
        shopCustomDomainUrl: string | null;
    }>;
}
//# sourceMappingURL=cms.service.d.ts.map