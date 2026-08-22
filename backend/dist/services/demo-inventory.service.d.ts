export type DemoInventoryImportResult = {
    success: true;
    replaced: boolean;
    categoriesCreated: number;
    unitsCreated: number;
    suppliersCreated: number;
    itemsCreated: number;
    recipesCreated: number;
    stockMovementsCreated: number;
};
export type DemoInventoryDeleteResult = {
    success: true;
    itemsDeleted: number;
    categoriesDeleted: number;
    suppliersDeleted: number;
    unitsDeleted: number;
    ratiosDeleted: number;
    recipesDeleted: number;
};
export type InventoryDashboardScenario = {
    id: string;
    tone: "warning" | "success" | "info";
    params?: Record<string, string | number>;
};
export type InventoryDashboardData = {
    hasDemoData: boolean;
    hasAnyData: boolean;
    kpis: {
        stockValue: number;
        itemCount: number;
        lowStockCount: number;
        belowReorderCount: number;
        recipesLinkedCount: number;
        recipesTotalProducts: number;
        recipesLinkedPct: number;
        wastePct: number;
        stockInThisWeek: number;
        movementsThisWeek: number;
        turnoverRatio: number;
    };
    scenarios: InventoryDashboardScenario[];
    stockInByDay: Array<{
        date: string;
        qty: number;
        cost: number;
    }>;
    lowStockItems: Array<{
        id: string;
        name: string;
        onHand: number;
        minStock: number;
        reorderQty: number;
        unit: string;
    }>;
    recipeExamples: Array<{
        productId: string;
        productName: string;
        recipeYield: number;
        exampleLabel: string;
        autoConsumption: boolean;
        lines: Array<{
            itemName: string;
            qty: number;
            unit: string;
        }>;
    }>;
};
export declare class DemoInventoryService {
    /** True when any inventory row is flagged is_demo for this merchant. */
    static hasDemoData(merchantId: string): Promise<boolean>;
    /**
     * Idempotent: removes existing demo inventory for this merchant, then seeds fresh sample data.
     * Real (non-demo) inventory rows are never touched.
     */
    static importDemo(merchantId: string): Promise<DemoInventoryImportResult>;
    /** Removes all demo-flagged inventory rows. Non-demo data is untouched. */
    static deleteDemo(merchantId: string): Promise<DemoInventoryDeleteResult>;
    /** Overview KPIs, scenarios and charts for the inventory home dashboard. */
    static getDashboard(merchantId: string): Promise<InventoryDashboardData>;
}
//# sourceMappingURL=demo-inventory.service.d.ts.map