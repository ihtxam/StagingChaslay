import type { VoucherDiscountType, VoucherUsageType } from "@/db/schema";
export type VoucherInput = {
    code: string;
    name?: string | null;
    usageType?: VoucherUsageType;
    maxRedemptions?: number;
    customerId?: string | null;
    discountType?: VoucherDiscountType;
    discountValue: number;
    minOrderAmount?: number;
    validFrom?: string | Date | null;
    validTo?: string | Date | null;
    isActive?: boolean;
};
export declare class VoucherService {
    static normalizeCode(code: string): string;
    static list(merchantId: string): Promise<{
        id: string;
        code: string;
        name: string | null;
        usageType: string;
        maxRedemptions: number;
        customerId: string | null;
        customer: {
            id: string;
            email: string | null;
            name: string;
        } | null;
        discountType: string;
        discountValue: number;
        minOrderAmount: number;
        validFrom: Date | null;
        validTo: Date | null;
        isActive: boolean;
        redemptionCount: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    static getById(merchantId: string, voucherId: string): Promise<{
        id: string;
        code: string;
        name: string | null;
        usageType: string;
        maxRedemptions: number;
        customerId: string | null;
        customer: {
            id: string;
            email: string | null;
            name: string;
        } | null;
        discountType: string;
        discountValue: number;
        minOrderAmount: number;
        validFrom: Date | null;
        validTo: Date | null;
        isActive: boolean;
        redemptionCount: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static create(merchantId: string, input: VoucherInput): Promise<{
        id: string;
        code: string;
        name: string | null;
        usageType: string;
        maxRedemptions: number;
        customerId: string | null;
        customer: {
            id: string;
            email: string | null;
            name: string;
        } | null;
        discountType: string;
        discountValue: number;
        minOrderAmount: number;
        validFrom: Date | null;
        validTo: Date | null;
        isActive: boolean;
        redemptionCount: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static update(merchantId: string, voucherId: string, input: Partial<VoucherInput>): Promise<{
        id: string;
        code: string;
        name: string | null;
        usageType: string;
        maxRedemptions: number;
        customerId: string | null;
        customer: {
            id: string;
            email: string | null;
            name: string;
        } | null;
        discountType: string;
        discountValue: number;
        minOrderAmount: number;
        validFrom: Date | null;
        validTo: Date | null;
        isActive: boolean;
        redemptionCount: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static remove(merchantId: string, voucherId: string): Promise<void>;
    static listRedemptions(merchantId: string, voucherId: string): Promise<{
        id: string;
        code: string;
        discountAmount: number;
        createdAt: Date;
        customer: {
            id: string;
            email: string | null;
            firstName: string | null;
            lastName: string | null;
        } | null;
        order: {
            id: string;
            orderNumber: string;
            total: string;
        } | null;
    }[]>;
    static computeDiscount(voucher: {
        discountType: string;
        discountValue: string | number;
    }, subtotal: number): number;
    static validateForShop(merchantId: string, code: string, subtotal: number, customerId?: string): Promise<{
        voucherId: string;
        code: string;
        name: string;
        discountType: string;
        discountValue: number;
        discount: number;
    }>;
    static redeem(merchantId: string, voucherId: string, opts: {
        orderId: string;
        customerId?: string | null;
        discountAmount: number;
        code: string;
    }): Promise<void>;
    private static serialize;
}
//# sourceMappingURL=voucher.service.d.ts.map