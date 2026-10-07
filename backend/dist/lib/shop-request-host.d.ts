declare function hostFromRequest(headers: Record<string, unknown>): string;
export declare function isPanelAppHost(hostname: string): boolean;
export declare function isShopPathHubHost(hostname: string): boolean;
/** True when this host serves customer shops (path, subdomain, or custom domain). */
export declare function isShopRequestHost(headers: Record<string, unknown>): boolean;
export declare function shopSlugFromPath(path: string): string | null;
export declare function requestLooksLikeSpaDocument(path: string, accept: string): boolean;
export { hostFromRequest };
//# sourceMappingURL=shop-request-host.d.ts.map