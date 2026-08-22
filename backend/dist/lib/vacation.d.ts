import type { LocalizedText, VacationPeriod, VacationSettings } from "@/db/schema";
/** Calendar date YYYY-MM-DD in Europe/Zurich. */
export declare function ymdZurich(at?: Date): string;
/**
 * Inclusive start / end instants for a Zurich calendar day (YYYY-MM-DD).
 * Avoids `new Date("YYYY-MM-DDT00:00:00")` which is server-local/UTC and drops
 * early-morning Zurich sales from "today" lists.
 */
export declare function zurichDayBounds(ymd: string): {
    start: Date;
    end: Date;
};
/** HH:mm in Europe/Zurich. */
export declare function hmZurich(at?: Date): string;
export declare function normalizeLocalizedText(raw: LocalizedText | string | null | undefined): LocalizedText | null;
export declare function resolveLocalized(raw: LocalizedText | string | null | undefined, locale: string, fallback?: string): string;
/** Master switch: schedules only apply when enabled. */
export declare function isVacationEnabled(raw: VacationSettings | null | undefined): boolean;
export declare function normalizeVacationSettings(raw: VacationSettings | null | undefined): VacationSettings;
export declare function findActiveVacationPeriod(raw: VacationSettings | null | undefined, at?: Date): VacationPeriod | null;
export declare function isVacationActive(raw: VacationSettings | null | undefined, at?: Date): boolean;
/**
 * True when a calendar date (YYYY-MM-DD) overlaps a programmed vacation period.
 * Only when the master switch is enabled.
 */
export declare function isDateInVacationPeriods(raw: VacationSettings | null | undefined, ymd: string): boolean;
export declare function vacationPublicPayload(raw: VacationSettings | null | undefined, at?: Date): {
    active: boolean;
    enabled: boolean;
    message: string | LocalizedText | null | undefined;
    popupTitle: string | LocalizedText | null | undefined;
    popupImageUrl: string | null | undefined;
    periods: VacationPeriod[] | undefined;
};
export declare const VACATION_BLOCK_MESSAGE = "We are currently on vacation. Online orders and reservations are temporarily unavailable.";
export declare const NOT_ACCEPTING_ORDERS_MESSAGE = "We are not accepting orders at the moment, please call us";
export declare const NOT_ACCEPTING_RESERVATIONS_MESSAGE = "We are not accepting reservations at the moment, please call us";
//# sourceMappingURL=vacation.d.ts.map