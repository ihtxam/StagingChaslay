export type TableShape = "rect" | "round";
export type TableStatus = "available" | "occupied" | "reserved" | "dirty";
export type DiningTableInput = {
    id?: string;
    label: string;
    capacity?: number;
    shape?: TableShape;
    posX?: number;
    posY?: number;
    width?: number;
    height?: number;
    rotation?: number;
    status?: TableStatus;
    sortOrder?: number;
};
export type FloorPlanElementInput = {
    id: string;
    elementType: "WALL" | "DOOR" | "BAR" | "OBSTACLE";
    posX: number;
    posY: number;
    width: number;
    height: number;
    rotation?: number;
};
export declare class FloorPlanService {
    static list(merchantId: string): Promise<{
        id: any;
        name: any;
        canvasWidth: any;
        canvasHeight: any;
        sortOrder: any;
        isActive: any;
        tables: any;
        elements: FloorPlanElementInput[];
        createdAt: any;
        updatedAt: any;
    }[]>;
    static getPlan(merchantId: string, planId: string): Promise<{
        id: any;
        name: any;
        canvasWidth: any;
        canvasHeight: any;
        sortOrder: any;
        isActive: any;
        tables: any;
        elements: FloorPlanElementInput[];
        createdAt: any;
        updatedAt: any;
    }>;
    static createPlan(merchantId: string, name: string): Promise<{
        id: any;
        name: any;
        canvasWidth: any;
        canvasHeight: any;
        sortOrder: any;
        isActive: any;
        tables: any;
        elements: FloorPlanElementInput[];
        createdAt: any;
        updatedAt: any;
    }>;
    static updatePlan(merchantId: string, planId: string, updates: {
        name?: string;
        canvasWidth?: number;
        canvasHeight?: number;
        isActive?: boolean;
        sortOrder?: number;
    }): Promise<{
        id: any;
        name: any;
        canvasWidth: any;
        canvasHeight: any;
        sortOrder: any;
        isActive: any;
        tables: any;
        elements: FloorPlanElementInput[];
        createdAt: any;
        updatedAt: any;
    }>;
    static deletePlan(merchantId: string, planId: string): Promise<{
        success: boolean;
    }>;
    /** Replace all tables on a plan (designer save). */
    static saveTables(merchantId: string, planId: string, tables: DiningTableInput[], elements?: FloorPlanElementInput[]): Promise<{
        id: any;
        name: any;
        canvasWidth: any;
        canvasHeight: any;
        sortOrder: any;
        isActive: any;
        tables: any;
        elements: FloorPlanElementInput[];
        createdAt: any;
        updatedAt: any;
    }>;
    /** Add multiple tables with sequential labels (batch create). */
    static batchAddTables(merchantId: string, planId: string, input: {
        prefix?: string;
        startNumber?: number;
        count?: number;
        capacity?: number;
    }): Promise<{
        id: any;
        name: any;
        canvasWidth: any;
        canvasHeight: any;
        sortOrder: any;
        isActive: any;
        tables: any;
        elements: FloorPlanElementInput[];
        createdAt: any;
        updatedAt: any;
    }>;
    /** Patch a single table without replacing the whole plan. */
    static patchTable(merchantId: string, tableId: string, patch: Partial<DiningTableInput & {
        floorPlanId?: string;
    }>): Promise<{
        id: string;
        merchantId: string;
        floorPlanId: string;
        label: string;
        capacity: number;
        shape: string;
        posX: number;
        posY: number;
        width: number;
        height: number;
        rotation: number;
        status: string;
        currentOrderId: string | null;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /** Delete one table from a plan. */
    static deleteTable(merchantId: string, tableId: string): Promise<{
        success: boolean;
    }>;
    /** Add one table to a section. */
    static addTable(merchantId: string, planId: string, input: {
        label: string;
        capacity?: number;
    }): Promise<{
        id: any;
        name: any;
        canvasWidth: any;
        canvasHeight: any;
        sortOrder: any;
        isActive: any;
        tables: any;
        elements: FloorPlanElementInput[];
        createdAt: any;
        updatedAt: any;
    }>;
    static setTableStatus(merchantId: string, tableId: string, status: TableStatus, currentOrderId?: string | null): Promise<{
        id: string;
        merchantId: string;
        floorPlanId: string;
        label: string;
        capacity: number;
        shape: string;
        posX: number;
        posY: number;
        width: number;
        height: number;
        rotation: number;
        status: string;
        currentOrderId: string | null;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /** Covers served today = sum(guest_count) for completed dine-in orders. */
    static coversReport(merchantId: string, date?: Date): Promise<{
        date: string;
        totalOrders: number;
        dineInOrders: number;
        coversServed: number;
        averagePartySize: number;
        dineInRevenue: number;
    }>;
    /** Flat table list for POS sync. */
    static listTablesForSync(merchantId: string): Promise<{
        id: string;
        floorPlanId: string;
        floorPlanName: string;
        label: string;
        capacity: number;
        shape: string;
        posX: number;
        posY: number;
        width: number;
        height: number;
        rotation: number;
        status: string;
        currentOrderId: string | null;
    }[]>;
    private static serializePlan;
}
//# sourceMappingURL=floor-plan.service.d.ts.map