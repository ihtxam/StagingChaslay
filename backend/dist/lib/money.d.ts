/**
 * Swiss cash rounding to 0.05 (5 Rappen / 5 centimes).
 * Intermediate amounts use 0.01; payable totals use 0.05.
 */
export declare function roundMoney2(amount: number): number;
/** Round to nearest 0.05 CHF. */
export declare function roundTo005(amount: number): number;
/** Difference applied to reach 0.05 total (can be negative). */
export declare function roundingAdjustment(rawTotal: number): number;
/** Split a 0.05-rounded total into N parts that each land on 0.05. */
export declare function splitEqual005(total: number, parts: number): number[];
//# sourceMappingURL=money.d.ts.map