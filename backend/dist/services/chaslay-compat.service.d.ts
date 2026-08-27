import { schema } from "@/db";
export declare function normalizeChaslayDeviceId(deviceId: string): string;
export declare function deriveShortDeviceId(raw: string): string;
export declare function normalizeActivationCode(code: string): string;
export declare function generateSyncApiKey(): string;
export declare class ChaslayCompatService {
    static activateLicense(input: {
        deviceId: string;
        activationCode: string;
        appVersion?: string;
        deviceModel?: string;
        tenantSlug?: string | null;
    }): Promise<{
        status: string;
        expiresAt: number;
        customerName: string;
        planLabel: string;
        tenantSlug: string | null;
    }>;
    static validateLicense(input: {
        deviceId: string;
        appVersion?: string;
        tenantSlug?: string | null;
    }): Promise<{
        status: string;
        expiresAt: number;
        customerName: string;
        planLabel: string;
    }>;
    static posLogin(email: string, password: string, tenantSlug?: string | null): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            roleName: string;
            tenantSlug: string | null;
        };
        merchantId: string;
        syncApiKey: string;
        dashboardToken: string;
        dashboardUser: {
            id: string;
            email: string;
            name: string;
            role: "merchant";
            merchantId: string;
            isOwner: boolean;
            roleName: string;
        };
        dashboardUrl: string;
    } | {
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
            roleName: string;
            permissions: string[];
            tenantSlug: string | null;
        };
        merchantId: string;
        syncApiKey: string;
        dashboardToken: string;
        dashboardUser: {
            id: string;
            email: string;
            name: string;
            role: "staff";
            merchantId: string;
            staffId: string;
            isOwner: boolean;
            roleName: string;
            permissions: ("USE_POS" | "USE_WEBPOS" | "PROCESS_PAYMENTS" | "APPLY_DISCOUNTS" | "OPEN_CASH_DRAWER" | "SEND_KITCHEN" | "MANAGE_TABLES" | "TAKEAWAY_ORDERS" | "DELIVERY_ORDERS" | "VIEW_DELIVERY_TRACKING" | "VIEW_ORDER_HISTORY" | "CANCEL_ORDERS" | "REFUND_ORDERS" | "VIEW_REPORTS" | "VIEW_ALL_SALES" | "MANAGE_PRODUCTS" | "MANAGE_CUSTOMERS" | "MANAGE_OFFERS" | "MANAGE_ONLINE_SHOP" | "MANAGE_SETTINGS" | "ACCESS_PANEL" | "MANAGE_STAFF" | "MANAGE_ROLES" | "MANAGE_BILLING" | "END_OF_DAY" | "MANAGE_INVENTORY" | "STOREKEEPER_INTAKE")[];
        };
        dashboardUrl: string;
    }>;
    private static ensureMerchantSyncKey;
    private static posLoginOwner;
    private static posLoginStaff;
    static syncBootstrap(merchantId: string): Promise<{
        serverTime: number;
        tenant: {
            id: string;
            slug: string | null;
            name: string;
            currency_symbol: string;
        };
        business: {
            name: string;
            phone: string | null;
            email: string;
            address: string | null;
            vat_number: string | null;
            vat_rate: number;
            tax_takeaway_rate: number;
            tax_dine_in_rate: number;
            tax_delivery_rate: number;
            tax_included_in_price: boolean;
            vat_after_discount: boolean;
            default_language: string;
            store_hours: Record<string, Record<string, {
                open: string;
                close: string;
            }[]>>;
            receipt_base_url: string;
        };
        categories: {
            deleted_at?: string | undefined;
            id: string;
            name: string;
            sort_order: number;
            color_hex: string | null;
            online_visible: boolean;
            kiosk_visible: boolean;
            updated_at: string;
        }[];
        products: {
            deleted_at?: string | undefined;
            id: string;
            category_id: string | null;
            name: string;
            description: string | null;
            price: number;
            tax_rate: number;
            sku: string | null;
            barcode: string | null;
            image_url: string | null;
            sort_order: number;
            in_stock: boolean;
            is_open_price: boolean;
            sold_by_weight: boolean;
            product_type: string;
            allow_extras: boolean;
            extras: {
                id: string;
                name: string;
                price: number;
            }[];
            modifier_groups: any[];
            combo_items: {
                id: string;
                name: string;
                minPick: number;
                maxPick: number;
                options: {
                    productId: string;
                    product_id: string;
                    sourceProductId: string;
                    extraPrice: number;
                    name: string | undefined;
                    image: string | undefined;
                    allow_extras: boolean;
                    extras: {
                        id: string;
                        name: string;
                        price: number;
                    }[];
                    modifier_groups: any[];
                }[];
            }[];
            specifications: {
                id: string;
                name: string;
                price: number;
                saleStatus?: "in_stock" | "out_of_stock";
                isDefault?: boolean;
                sortOrder?: number;
            }[];
            variants: {
                id: any;
                name: string;
                price: number;
                is_default: boolean;
                sort_order: number;
                sale_status: any;
            }[];
            online_visible: boolean;
            kiosk_visible: boolean;
            updated_at: string;
        }[];
        paymentConfig: {
            adyen: {
                merchant_account: string | null;
                api_key: string | null;
                client_id: string | null;
            };
            default_terminal_id: string | null;
            terminals: {
                id: string;
                terminal_id: string;
                terminal_name: string;
                serial_number: string | null;
                status: string;
            }[];
            terminal_ready: boolean;
            methods: {
                express: boolean;
                cash: boolean;
                card: boolean;
                terminal: boolean;
                giftCard: boolean;
                invoice: boolean;
            };
            loyalty: import("@/services/shop-loyalty.service").LoyaltyProgramSettings;
            features: {
                courses_enabled: boolean;
                floor_plan_enabled: boolean;
                pax_ordering_enabled: boolean;
                shifts_enabled: boolean;
            };
            checkout: {
                vatIncludedInPrice: boolean;
                vatAfterDiscount: boolean;
                tipsEnabled: boolean;
                tipPresetsPercent: number[];
                allowCustomTip: boolean;
                discountsEnabled: boolean;
                discountPresets: import("@/lib/pos-checkout-settings").PosCheckoutDiscountPreset[];
                roundingStep: number;
                quickCashEnabled: boolean;
                quickCashDenominations: number[];
                splitBillsEnabled: boolean;
                maxSplitParts: number;
                courseSendMode: import("@/lib/pos-checkout-settings").CourseSendMode;
                cartSide: import("@/lib/pos-checkout-settings").CartSide;
                postSuccessTarget: import("@/lib/pos-checkout-settings").PostSuccessTarget;
                posMode: import("@/lib/pos-checkout-settings").PosMode;
                tablesEnabled: boolean;
                retailTakeawayEnabled: boolean;
                retailDeliveryEnabled: boolean;
                retailDineInEnabled: boolean;
                requireTableForDineIn: boolean;
            };
            receipt_base_url: string;
            scale: {
                enabled: boolean;
                com_port: string | null;
                device_name: string | null;
                device_id: string | null;
                usb_address: string | null;
            };
            print: {
                adyen_receipt_digital_only: boolean;
                receipt_delivery_directions_qr: boolean;
                auto_print_kitchen: boolean;
                waiter_till_bell_enabled: boolean;
                kitchen_print_retry_enabled: boolean;
                kitchen_print_retry_attempts: number;
                kitchen_print_retry_interval_sec: number;
            };
        };
        floor_plans: {
            id: any;
            name: any;
            canvas_width: any;
            canvas_height: any;
            sort_order: any;
            tables: any;
        }[];
        reserved_table_ids: string[];
    }>;
    static getPaymentConfig(merchantId: string): Promise<{
        adyen: {
            merchant_account: string | null;
            api_key: string | null;
            client_id: string | null;
        };
        default_terminal_id: string | null;
        terminals: {
            id: string;
            terminal_id: string;
            terminal_name: string;
            serial_number: string | null;
            status: string;
        }[];
        terminal_ready: boolean;
        methods: {
            express: boolean;
            cash: boolean;
            card: boolean;
            terminal: boolean;
            giftCard: boolean;
            invoice: boolean;
        };
        loyalty: import("@/services/shop-loyalty.service").LoyaltyProgramSettings;
        features: {
            courses_enabled: boolean;
            floor_plan_enabled: boolean;
            pax_ordering_enabled: boolean;
            shifts_enabled: boolean;
        };
        checkout: {
            vatIncludedInPrice: boolean;
            vatAfterDiscount: boolean;
            tipsEnabled: boolean;
            tipPresetsPercent: number[];
            allowCustomTip: boolean;
            discountsEnabled: boolean;
            discountPresets: import("@/lib/pos-checkout-settings").PosCheckoutDiscountPreset[];
            roundingStep: number;
            quickCashEnabled: boolean;
            quickCashDenominations: number[];
            splitBillsEnabled: boolean;
            maxSplitParts: number;
            courseSendMode: import("@/lib/pos-checkout-settings").CourseSendMode;
            cartSide: import("@/lib/pos-checkout-settings").CartSide;
            postSuccessTarget: import("@/lib/pos-checkout-settings").PostSuccessTarget;
            posMode: import("@/lib/pos-checkout-settings").PosMode;
            tablesEnabled: boolean;
            retailTakeawayEnabled: boolean;
            retailDeliveryEnabled: boolean;
            retailDineInEnabled: boolean;
            requireTableForDineIn: boolean;
        };
        receipt_base_url: string;
        scale: {
            enabled: boolean;
            com_port: string | null;
            device_name: string | null;
            device_id: string | null;
            usb_address: string | null;
        };
        print: {
            adyen_receipt_digital_only: boolean;
            receipt_delivery_directions_qr: boolean;
            auto_print_kitchen: boolean;
            waiter_till_bell_enabled: boolean;
            kitchen_print_retry_enabled: boolean;
            kitchen_print_retry_attempts: number;
            kitchen_print_retry_interval_sec: number;
        };
        serverTime: number;
    }>;
    private static getPaymentConfigPayload;
    static pushTerminalsFromDevice(merchantId: string, input: {
        terminals?: Array<{
            terminalId?: string;
            terminalName?: string;
            serialNumber?: string;
            status?: string;
        }>;
        defaultTerminalId?: string;
        adyenMerchantAccount?: string;
        adyenApiKey?: string;
        adyenClientId?: string;
        adyenTerminalEnabled?: boolean;
        deviceLabel?: string;
    }): Promise<{
        ok: boolean;
        upserted: number;
        serverTime: number;
    }>;
    static syncMenuChanges(merchantId: string, sinceMs: number): Promise<{
        serverTime: number;
        categories: {
            deleted_at?: string | undefined;
            id: string;
            name: string;
            sort_order: number;
            color_hex: string | null;
            online_visible: boolean;
            kiosk_visible: boolean;
            updated_at: string;
        }[];
        products: {
            deleted_at?: string | undefined;
            id: string;
            category_id: string | null;
            name: string;
            description: string | null;
            price: number;
            tax_rate: number;
            sku: string | null;
            barcode: string | null;
            image_url: string | null;
            sort_order: number;
            in_stock: boolean;
            is_open_price: boolean;
            sold_by_weight: boolean;
            product_type: string;
            allow_extras: boolean;
            extras: {
                id: string;
                name: string;
                price: number;
            }[];
            modifier_groups: any[];
            combo_items: {
                id: string;
                name: string;
                minPick: number;
                maxPick: number;
                options: {
                    productId: string;
                    product_id: string;
                    sourceProductId: string;
                    extraPrice: number;
                    name: string | undefined;
                    image: string | undefined;
                    allow_extras: boolean;
                    extras: {
                        id: string;
                        name: string;
                        price: number;
                    }[];
                    modifier_groups: any[];
                }[];
            }[];
            specifications: {
                id: string;
                name: string;
                price: number;
                saleStatus?: "in_stock" | "out_of_stock";
                isDefault?: boolean;
                sortOrder?: number;
            }[];
            variants: {
                id: any;
                name: string;
                price: number;
                is_default: boolean;
                sort_order: number;
                sale_status: any;
            }[];
            online_visible: boolean;
            kiosk_visible: boolean;
            updated_at: string;
        }[];
    }>;
    static incomingOrders(merchantId: string, sinceMs: number): Promise<{
        serverTime: number;
        orders: {
            id: string;
            order_number: string;
            source: string;
            status: string;
            service_type: string;
            fulfillment_type: string;
            customer_name: string | null;
            customer_phone: string | null;
            delivery_address: string | null;
            pickup_time_ms: number | null;
            subtotal: number;
            tax_total: number;
            total: number;
            notes: string | null;
            payload: {
                items: {
                    productName: string;
                    quantity: number;
                    unitPrice: number;
                    lineTotal: number;
                }[];
            };
            created_at: string;
        }[];
    }>;
    static ackOrder(merchantId: string, orderId: string): Promise<{
        ok: boolean;
    }>;
    static mapCategory(c: typeof schema.categories.$inferSelect, includeDeleted?: boolean): {
        deleted_at?: string | undefined;
        id: string;
        name: string;
        sort_order: number;
        color_hex: string | null;
        online_visible: boolean;
        kiosk_visible: boolean;
        updated_at: string;
    };
    static mapProduct(p: typeof schema.products.$inferSelect, includeDeleted?: boolean, categoryClientById?: Map<string, string>, productClientById?: Map<string, string>, groupsByProduct?: Map<string, any[]>, catalogById?: Map<string, typeof schema.products.$inferSelect>): {
        deleted_at?: string | undefined;
        id: string;
        category_id: string | null;
        name: string;
        description: string | null;
        price: number;
        tax_rate: number;
        sku: string | null;
        barcode: string | null;
        image_url: string | null;
        sort_order: number;
        in_stock: boolean;
        is_open_price: boolean;
        sold_by_weight: boolean;
        product_type: string;
        allow_extras: boolean;
        extras: {
            id: string;
            name: string;
            price: number;
        }[];
        modifier_groups: any[];
        combo_items: {
            id: string;
            name: string;
            minPick: number;
            maxPick: number;
            options: {
                productId: string;
                product_id: string;
                sourceProductId: string;
                extraPrice: number;
                name: string | undefined;
                image: string | undefined;
                allow_extras: boolean;
                extras: {
                    id: string;
                    name: string;
                    price: number;
                }[];
                modifier_groups: any[];
            }[];
        }[];
        specifications: {
            id: string;
            name: string;
            price: number;
            saleStatus?: "in_stock" | "out_of_stock";
            isDefault?: boolean;
            sortOrder?: number;
        }[];
        variants: {
            id: any;
            name: string;
            price: number;
            is_default: boolean;
            sort_order: number;
            sale_status: any;
        }[];
        online_visible: boolean;
        kiosk_visible: boolean;
        updated_at: string;
    };
    private static mapComboOption;
    static receiptPublicUrl(ref: string): string;
}
//# sourceMappingURL=chaslay-compat.service.d.ts.map