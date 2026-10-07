export declare class GuestCrmService {
    static listProfiles(merchantId: string, opts: {
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<{
        page: number;
        limit: number;
        profiles: {
            id: string;
            name: string;
            firstName: string | null;
            lastName: string | null;
            email: string | null;
            phone: string | null;
            loyaltyPoints: number;
            totalSpent: number;
            marketingOptIn: boolean;
            lastOrderAt: string | null;
            tags: string[];
            orderCount: number;
            lastVisit: string | null;
            lifetimeRevenue: number;
            createdAt: string | null;
        }[];
    }>;
    static getProfile(merchantId: string, customerId: string): Promise<{
        profile: {
            id: string;
            name: string;
            firstName: string | null;
            lastName: string | null;
            email: string | null;
            phone: string | null;
            loyaltyPoints: number;
            totalSpent: number;
            marketingOptIn: boolean;
            tags: string[];
            orderCount: number;
            lastVisit: string | null;
        };
        recentOrders: {
            id: string;
            orderNumber: string;
            orderType: string;
            total: number;
            createdAt: string | null;
        }[];
    }>;
    static updateTags(merchantId: string, customerId: string, tags: string[]): Promise<{
        tags: string[];
    }>;
}
//# sourceMappingURL=guest-crm.service.d.ts.map