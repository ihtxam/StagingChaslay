import type { OrderSource } from "@/lib/delivery-platform-settings";
/** Push a persisted order to KDS + ODS (idempotent). Optional kitchen print enqueue. */
export declare function enterKitchenFromOrder(merchantId: string, orderId: string, opts?: {
    printKitchen?: boolean;
    orderSource?: OrderSource;
}): Promise<void>;
//# sourceMappingURL=kitchen-ingress.service.d.ts.map