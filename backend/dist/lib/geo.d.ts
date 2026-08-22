/** Point-in-polygon (ray casting). Ring is [lng, lat][]. */
export declare function pointInPolygon(lng: number, lat: number, ring: Array<[number, number]>): boolean;
export declare function normalizeRing(ring: Array<[number, number]>): Array<[number, number]>;
declare const DAY_KEYS: readonly ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export type DayKey = (typeof DAY_KEYS)[number];
export type HoursSlot = {
    open: string;
    close: string;
};
export type ChannelHours = Partial<Record<DayKey, HoursSlot[]>>;
/** `display` = homepage / shop banner hours (informational). Order channels gate checkout. */
export type StoreHoursChannel = "takeaway" | "dine_in" | "delivery" | "display";
export type StoreHours = Partial<Record<StoreHoursChannel, ChannelHours>>;
/** Merchants are CH-based; evaluate hours in Zurich wall-clock, not server UTC. */
export declare const MERCHANT_TZ = "Europe/Zurich";
export declare function parseHm(hm: string): number;
export declare function zonedDayAndMinutes(at: Date, timeZone?: string): {
    day: DayKey;
    mins: number;
};
/** Is the channel open at `at` in merchant timezone (Europe/Zurich). */
export declare function isChannelOpenNow(storeHours: StoreHours | null | undefined, channel: StoreHoursChannel, at?: Date): {
    open: boolean;
    todayLabel: string;
    slots: HoursSlot[];
};
/**
 * Homepage / shop banner hours. Prefers `display`, else falls back to the active order channel.
 */
export declare function getDisplayHoursNow(storeHours: StoreHours | null | undefined, fallbackChannel?: "takeaway" | "dine_in" | "delivery", at?: Date): {
    open: boolean;
    todayLabel: string;
    slots: HoursSlot[];
};
/** True if `at` falls inside any opening range for that channel/day (Zurich time). */
export declare function isWithinChannelHours(storeHours: StoreHours | null | undefined, channel: "takeaway" | "dine_in" | "delivery", at: Date): boolean;
export declare function defaultStoreHours(): StoreHours;
export {};
//# sourceMappingURL=geo.d.ts.map