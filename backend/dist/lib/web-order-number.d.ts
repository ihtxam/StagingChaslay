import { getDb } from "@/db";
type Db = ReturnType<typeof getDb>;
/** Stable 4-char merchant code for globally unique WEB order numbers. */
export declare function merchantWebOrderCode(merchantId: string): string;
/** Display-friendly web order number — keeps scoped WEB-CODE-SEQ; shortens legacy timestamps. */
export declare function formatWebOrderNumberDisplay(orderNumber: string): string;
/** Next short WEB-xxxx number for a merchant (daily sequence, Europe/Zurich). */
export declare function generateWebOrderNumber(db: Db, merchantId: string): Promise<string>;
export {};
//# sourceMappingURL=web-order-number.d.ts.map