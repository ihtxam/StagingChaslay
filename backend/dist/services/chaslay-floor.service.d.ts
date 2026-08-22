export declare class ChaslayFloorService {
    static registerDevice(merchantId: string, input: {
        deviceId: string;
        deviceName?: string | null;
        role?: string | null;
        lanHost?: string | null;
        appVersion?: string | null;
    }): Promise<{
        ok: boolean;
        serverTime: number;
    }>;
    static getMainPos(merchantId: string): Promise<{
        lanHost: null;
        deviceName: null;
        lastSeenAt: null;
    } | {
        lanHost: string | null;
        deviceName: string | null;
        lastSeenAt: string;
    }>;
    static listOrders(merchantId: string, sinceMs: number): Promise<{
        serverTime: number;
        orders: {
            local_order_id: string;
            table_id: number;
            table_name: string;
            status: string;
            service_type: string;
            user_id: number;
            user_name: string;
            cart_json: Record<string, unknown> | null;
            source_device_id: string;
            updated_at: string;
        }[];
    }>;
    static upsertOrder(merchantId: string, localOrderId: string, body: {
        tableId?: number;
        tableName?: string;
        status?: string;
        serviceType?: string;
        userId?: number;
        userName?: string;
        cart?: Record<string, unknown>;
        sourceDeviceId?: string;
    }): Promise<{
        ok: boolean;
        serverTime: number;
    }>;
    static createPrintJob(merchantId: string, input: {
        jobType: string;
        payload: Record<string, unknown>;
        sourceDeviceId?: string;
        orderId?: string | null;
    }): Promise<{
        ok: boolean;
        jobId: string;
        createdAt: string;
    }>;
    /**
     * Atomically claim PENDING print jobs (→ PROCESSING) so overlapping pollers
     * (WebPOS 2.5s interval, multi-tab, Android MAIN_POS) cannot reprint the same job.
     */
    static listPendingPrintJobs(merchantId: string, limit: number, opts?: {
        jobTypes?: string[];
        excludeJobTypes?: string[];
    }): Promise<{
        serverTime: number;
        jobs: {
            id: string;
            job_type: string;
            jobType: string;
            payload: Record<string, unknown> | null;
            source_device_id: string;
            sourceDeviceId: string;
            order_id: string | null;
            orderId: string | null;
            created_at: string;
            createdAt: string;
        }[];
    }>;
    static ackPrintJob(merchantId: string, jobId: string, status: "DONE" | "FAILED"): Promise<{
        ok: boolean;
    }>;
    /** Emergency: mark all open print jobs FAILED so runaway printers stop. */
    static failOpenPrintJobs(merchantId: string): Promise<{
        ok: boolean;
        cleared: number;
    }>;
}
//# sourceMappingURL=chaslay-floor.service.d.ts.map