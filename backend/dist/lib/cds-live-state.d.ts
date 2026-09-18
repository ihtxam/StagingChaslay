export type CdsLivePhase = "idle" | "building" | "payment" | "thankyou";
export type CdsLiveLocale = "en" | "fr" | "de";
export type CdsLiveLine = {
    name: string;
    qty: number;
    lineTotal: number;
    modifiers?: string;
};
export type CdsLiveState = {
    merchantName?: string;
    currency: string;
    lines: CdsLiveLine[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    phase: CdsLivePhase;
    receiptUrl?: string;
    locale?: CdsLiveLocale;
    updatedAt: number;
};
export declare function normalizeCdsLiveState(raw: unknown): CdsLiveState | null;
export declare function setCdsLiveState(accessToken: string, merchantId: string, state: CdsLiveState): void;
export declare function getCdsLiveState(accessToken: string): CdsLiveState | null;
export declare function sweepExpiredCdsLiveState(): void;
//# sourceMappingURL=cds-live-state.d.ts.map