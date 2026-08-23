export declare const ODS_THEMES: readonly ["light", "teal", "dark"];
export type OdsTheme = (typeof ODS_THEMES)[number];
export declare class OdsLicenseError extends Error {
    code: string;
    constructor();
}
export type OdsDisplayInput = {
    name: string;
    theme?: OdsTheme;
    isActive?: boolean;
};
export type OdsPushPayload = {
    orderNumber: string;
    status: "preparing" | "ready";
};
export declare class OdsService {
    static listDisplays(merchantId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        theme: string;
    }[]>;
    static createDisplay(merchantId: string, input: OdsDisplayInput): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        theme: string;
    }>;
    static updateDisplay(merchantId: string, id: string, input: Partial<OdsDisplayInput>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        token: string;
        theme: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static deleteDisplay(merchantId: string, id: string): Promise<{
        ok: boolean;
    }>;
    static rotateToken(merchantId: string, id: string): Promise<{
        id: string;
        merchantId: string;
        name: string;
        token: string;
        theme: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static displayByToken(token: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        merchantId: string;
        token: string;
        theme: string;
    } | undefined>;
    /** Push or update an order on the customer board (POS / KDS integration). */
    static pushOrder(merchantId: string, payload: OdsPushPayload): Promise<{
        ok: boolean;
        skipped: boolean;
        orderNumber?: undefined;
        status?: undefined;
    } | {
        ok: boolean;
        orderNumber: string;
        status: string;
        skipped?: undefined;
    }>;
    static dismissOrder(merchantId: string, orderNumber: string): Promise<{
        ok: boolean;
    }>;
    static boardForToken(token: string): Promise<{
        display: {
            id: string;
            name: string;
            theme: OdsTheme;
        };
        serverTime: string;
        preparing: string[];
        ready: string[];
    }>;
}
//# sourceMappingURL=ods.service.d.ts.map