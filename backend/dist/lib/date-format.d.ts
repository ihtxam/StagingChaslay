export type DateInput = string | number | Date | null | undefined;
/** User-facing calendar date: DD-MM-YYYY (Europe/Zurich) */
export declare function formatDateDDMMYYYY(input: DateInput): string;
/** User-facing time: HH:mm (24h, Europe/Zurich) */
export declare function formatTimeHHMM(input: DateInput): string;
/** User-facing date + time: DD-MM-YYYY HH:mm */
export declare function formatDateTimeDDMMYYYY(input: DateInput): string;
//# sourceMappingURL=date-format.d.ts.map