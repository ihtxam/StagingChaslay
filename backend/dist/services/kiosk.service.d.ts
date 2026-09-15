import { type KioskSettings } from "@/lib/kiosk-settings";
export declare class KioskLicenseError extends Error {
    code: string;
    constructor();
}
export declare class KioskService {
    static getPublicConfig(token: string): Promise<{
        merchant: {
            id: string;
            name: string;
            slug: string;
        };
        settings: {
            name: string | undefined;
            promoSlides: import("@/lib/kiosk-settings").KioskPromoSlide[];
            slideBannerText: string | undefined;
            enabledLanguages: string[];
            defaultLanguage: string;
            tableMode: import("@/lib/kiosk-settings").KioskTableMode;
            membershipScanEnabled: boolean;
            idleTimeoutSeconds: number;
            locationSlug: string | null | undefined;
            cashPaymentEnabled: boolean;
            cardPaymentEnabled: boolean;
            takeawayEnabled: boolean;
            deliveryEnabled: boolean;
            dineInEnabled: boolean;
            attractHeadline: string | undefined;
            attractSubheadline: string | undefined;
            brandPrimaryColor: string | undefined;
            brandSecondaryColor: string | undefined;
            brandButtonTextColor: string | undefined;
            autoPrintKitchen: boolean;
            autoPrintReceipt: boolean;
            screenSizeIn: number;
            kioskLayout: string;
            categoryNav: string;
        };
        tables: {
            id: string;
            label: string;
        }[];
    }>;
    static getMenu(token: string): Promise<{
        menu: {
            id: string;
            name: string;
            image: string | undefined;
            color: string | undefined;
            items: {
                id: string;
                name: string;
                price: number;
                description: string | undefined;
                image: string | undefined;
                barcode: string | undefined;
                sku: string | undefined;
                productType: string;
                allowExtras: boolean;
                extras: {
                    id: string;
                    name: string;
                    price: number;
                }[];
                specifications: {
                    id: string;
                    name: string;
                    price: number;
                    saleStatus: string;
                    isDefault: boolean;
                    sortOrder: number;
                }[];
                modifierGroups: {
                    id: string;
                    title: string;
                    selectionType: string;
                    minSelectable: number;
                    maxSelectable: number;
                    pricingType: string;
                    options: {
                        id: string;
                        name: string;
                        price: number;
                        isDefault: boolean;
                        image: string | null;
                    }[];
                }[];
                comboSlots: {
                    id: string;
                    name: string;
                    minPick: number;
                    maxPick: number;
                    options: ({
                        productId: string;
                        name: string;
                        image: string | null;
                        description: string | null;
                        extraPrice: number;
                        allowExtras: boolean;
                        extras: {
                            id: string;
                            name: string;
                            price: number;
                        }[];
                        modifierGroups: {
                            id: string;
                            title: string;
                            selectionType: string;
                            minSelectable: number;
                            maxSelectable: number;
                            pricingType: string;
                            options: {
                                id: string;
                                name: string;
                                price: number;
                                isDefault: boolean;
                                image: string | null;
                            }[];
                        }[];
                    } | null)[];
                }[];
            }[];
        }[];
        locationId: string;
        bestsellerIds: string[];
    }>;
    static lookupMembership(token: string, code: string): Promise<{
        membershipPlan: import("../lib/membership-plans").MembershipPlan | null;
        stampCount: {};
        cardKind: string;
    }>;
    static payOrderAtTerminal(token: string, orderId: string): Promise<{
        approved: boolean;
        reference: string | null | undefined;
        customerReceipt: import("../lib/adyen-receipt").AdyenTerminalReceipt | null;
    }>;
    static readSettingsForMerchant(merchantId: string): Promise<KioskSettings>;
    static writeSettingsForMerchant(merchantId: string, raw: unknown): Promise<KioskSettings>;
    static regenerateToken(merchantId: string): Promise<KioskSettings>;
    static validateTokenForMerchant(merchantId: string, token: string): boolean;
    static assertTokenForMerchant(merchantId: string, token: string): Promise<KioskSettings>;
    static verifyAdminPin(settings: {
        adminPin?: string;
    }, pin: string): boolean;
    static getDiagnostics(merchantId: string): Promise<{
        terminalConfigured: boolean;
        terminalRegistered: boolean;
        terminalLabel: string | null;
        adyenConfigured: boolean;
        cashPaymentEnabled: boolean;
        cardPaymentEnabled: boolean;
        selectedTerminalId: string | null;
        terminals: {
            id: string;
            terminalId: string;
            terminalName: string;
            status: string;
        }[];
        printAgentNote: string;
    }>;
}
//# sourceMappingURL=kiosk.service.d.ts.map