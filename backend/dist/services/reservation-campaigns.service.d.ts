export declare class ReservationCampaignsService {
    static list(merchantId: string): Promise<{
        id: string;
        code: string;
        name: string;
        perkLabel: string | null;
        message: string | null;
        clickCount: number;
        bookingCount: number;
        active: boolean;
        createdAt: Date;
    }[]>;
    static save(merchantId: string, input: {
        id?: string;
        code?: string;
        name: string;
        perkLabel?: string | null;
        message?: string | null;
        active?: boolean;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        active: boolean;
        merchantId: string;
        code: string;
        message: string | null;
        perkLabel: string | null;
        clickCount: number;
        bookingCount: number;
    }>;
    static trackClick(merchantId: string, code: string): Promise<{
        id: string;
        merchantId: string;
        code: string;
        name: string;
        perkLabel: string | null;
        message: string | null;
        clickCount: number;
        bookingCount: number;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static trackBooking(merchantId: string, code: string): Promise<{
        id: string;
        merchantId: string;
        code: string;
        name: string;
        perkLabel: string | null;
        message: string | null;
        clickCount: number;
        bookingCount: number;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static publicInfo(merchantId: string, code: string): Promise<{
        code: string;
        name: string;
        perkLabel: string | null;
        message: string | null;
    } | null>;
}
//# sourceMappingURL=reservation-campaigns.service.d.ts.map