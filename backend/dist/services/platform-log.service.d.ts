import type { PlatformLogLevel } from '@/db/schema';
export type PlatformLogInput = {
    level?: PlatformLogLevel;
    category?: string;
    message: string;
    metadata?: Record<string, unknown>;
    actorRole?: string | null;
    actorId?: string | null;
    merchantId?: string | null;
    resellerId?: string | null;
};
export declare class PlatformLogService {
    static write(input: PlatformLogInput): Promise<{
        id: string;
        createdAt: Date;
        resellerId: string | null;
        merchantId: string | null;
        message: string;
        category: string;
        level: string;
        metadata: Record<string, unknown> | null;
        actorRole: string | null;
        actorId: string | null;
    }>;
    static list(opts?: {
        page?: number;
        limit?: number;
        level?: string;
        category?: string;
        from?: Date;
        to?: Date;
    }): Promise<{
        logs: {
            id: string;
            createdAt: Date;
            resellerId: string | null;
            merchantId: string | null;
            message: string;
            category: string;
            level: string;
            metadata: Record<string, unknown> | null;
            actorRole: string | null;
            actorId: string | null;
        }[];
        page: number;
        limit: number;
        total: number;
    }>;
}
//# sourceMappingURL=platform-log.service.d.ts.map