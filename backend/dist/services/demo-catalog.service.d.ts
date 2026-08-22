export type DemoImportMode = "replace" | "merge";
export type DemoImportResult = {
    success: true;
    mode: DemoImportMode;
    categoriesCreated: number;
    productsCreated: number;
    modifierGroupsCreated: number;
    combosCreated: number;
    categoriesSkipped: number;
    productsSkipped: number;
    modifierGroupsSkipped: number;
    combosSkipped: number;
    categoryNames: string[];
};
export declare class DemoCatalogService {
    static importDemo(merchantId: string, options?: {
        mode?: DemoImportMode;
        force?: boolean;
    }): Promise<DemoImportResult>;
    /** True when demo catalog products exist (clientId demo-prod-* / demo-combo-*). */
    static hasDemoData(merchantId: string): Promise<boolean>;
    /**
     * Removes imported demo catalog only (clientId prefix demo-prod- / demo-combo- / demo-cat-).
     * Real merchant products and categories are never touched.
     */
    static deleteDemo(merchantId: string): Promise<{
        success: true;
        productsDeleted: number;
        categoriesDeleted: number;
        modifierGroupsDeleted: number;
    }>;
}
//# sourceMappingURL=demo-catalog.service.d.ts.map