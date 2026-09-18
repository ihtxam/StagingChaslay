export type PosSessionKind = "main" | "waiter";
export type PosSessionPlatform = "webpos" | "waiter_web" | "android";
export declare const POS_SESSION_HEARTBEAT_SEC = 45;
export declare class PosSessionsService {
    static isActive(lastHeartbeat: Date | null | undefined): boolean;
    static getLimits(merchantId: string): Promise<{
        maxPosPosts: number;
        maxWaiterPosts: number;
    }>;
    static listActive(merchantId: string, sessionKind?: PosSessionKind): Promise<{
        id: string;
        locationId: string | null;
        sessionKind: PosSessionKind;
        platform: PosSessionPlatform;
        deviceId: string;
        deviceLabel: string | null;
        staffId: string | null;
        staffName: string | null;
        printAgentOnline: boolean | null;
        lastHeartbeat: Date;
        createdAt: Date;
    }[]>;
    private static mapSessionRow;
    private static listActiveRows;
    private static evictStale;
    private static enforceLimit;
    static registerSession(merchantId: string, input: {
        sessionKind: PosSessionKind;
        platform: PosSessionPlatform;
        deviceId: string;
        deviceLabel?: string | null;
        staffId?: string | null;
        staffName?: string | null;
        locationId?: string | null;
    }): Promise<{
        sessionId: string;
        heartbeatIntervalSec: number;
        maxPosPosts: number;
        maxWaiterPosts: number;
        kickedSessionIds: string[];
    }>;
    static heartbeat(merchantId: string, sessionId: string, opts?: {
        printAgentOnline?: boolean | null;
    }): Promise<{
        ok: boolean;
        lastHeartbeat: Date;
    }>;
    static revokeSession(merchantId: string, sessionId: string): Promise<{
        ok: boolean;
    }>;
    static revokeByDevice(merchantId: string, deviceId: string, sessionKind?: PosSessionKind): Promise<{
        ok: boolean;
    }>;
    /** Revoke every active POS / waiter session for a merchant (force logout all devices). */
    static revokeAllForMerchant(merchantId: string): Promise<{
        ok: boolean;
    }>;
}
//# sourceMappingURL=pos-sessions.service.d.ts.map