import fs from "fs";
export type ShopSpaIndexDeps = {
    fetchImpl?: typeof fetch;
    readFileSync?: typeof fs.readFileSync;
    statSync?: typeof fs.statSync;
    dashboardOrigin?: string;
    filePath?: string;
    now?: () => number;
    ttlMs?: number;
};
export declare function clearShopSpaIndexCache(): void;
/** Live dashboard index.html (hashed asset names). Falls back to bind-mounted file. */
export declare function loadShopSpaIndexHtml(deps?: ShopSpaIndexDeps): Promise<string | null>;
//# sourceMappingURL=shop-spa-index.d.ts.map