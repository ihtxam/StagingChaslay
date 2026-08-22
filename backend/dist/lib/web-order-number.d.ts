import { getDb } from "@/db";
type Db = ReturnType<typeof getDb>;
/** Display-friendly web order number — shortens legacy WEB-{timestamp}-{suffix} values. */
export declare function formatWebOrderNumberDisplay(orderNumber: string): string;
/** Next short WEB-xxxx number for a merchant (daily sequence, Europe/Zurich). */
export declare function generateWebOrderNumber(db: Db, merchantId: string): Promise<string>;
export {};
//# sourceMappingURL=web-order-number.d.ts.map