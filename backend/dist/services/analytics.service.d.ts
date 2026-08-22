export declare class AnalyticsService {
    /**
     * Get platform overview statistics
     */
    static getPlatformOverview(): Promise<{
        totalMerchants: number;
        activeLicenses: number;
        totalRevenue: number;
        platformGrowth: number;
        merchantUserCount: number;
        merchants: {
            total: number;
            active: number;
            trial: number;
            suspended: number;
        };
        licenses: {
            total: number;
            active: number;
            expired: number;
        };
        devices: {
            total: number;
            active: number;
        };
        orders: {
            total: number;
            totalRevenue: number;
            averageOrderValue: number;
        };
    }>;
    /**
     * Get revenue analytics
     */
    static getRevenueAnalytics(startDate?: Date, endDate?: Date): Promise<{
        period: {
            startDate: Date;
            endDate: Date;
        };
        summary: {
            totalRevenue: number;
            totalTax: number;
            totalDiscount: number;
            orderCount: number;
            averageOrderValue: number;
        };
        breakdown: {
            byPaymentMethod: Record<string, number>;
            byOrderType: Record<string, number>;
        };
    }>;
    /**
     * Get merchant growth analytics
     */
    static getMerchantGrowthAnalytics(months?: number): Promise<{
        period: string;
        monthlyGrowth: Record<string, number>;
        totalMerchants: number;
    }>;
    /**
     * Get top merchants by revenue
     */
    static getTopMerchantsByRevenue(limit?: number): Promise<{
        merchant: {
            id: string;
            name: string;
            email: string;
        };
        revenue: number;
        orderCount: number;
    }[]>;
    /**
     * Get license renewal forecast
     */
    static getLicenseRenewalForecast(daysAhead?: number): Promise<{
        period: string;
        forecast: Record<string, any[]>;
        totalExpiring: number;
    }>;
    /**
     * Get subscription plan distribution
     */
    static getSubscriptionDistribution(): Promise<{
        total: number;
        distribution: Record<string, number>;
        percentages: {
            free: string;
            starter: string;
            professional: string;
            enterprise: string;
        };
    }>;
    /**
     * Get payment method distribution
     */
    static getPaymentMethodDistribution(): Promise<{
        orderCount: number;
        distribution: Record<string, number>;
        revenue: Record<string, number>;
    }>;
}
//# sourceMappingURL=analytics.service.d.ts.map