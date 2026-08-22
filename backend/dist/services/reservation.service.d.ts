import { schema, type ReservationSettings, type ReservationStatus } from "@/db";
import { type ChannelHours, type HoursSlot, type StoreHours } from "@/lib/geo";
export declare const DEFAULT_RESERVATION_SETTINGS: Required<Omit<ReservationSettings, "maxCoversPerSlot" | "policiesText" | "slotDiscounts" | "lastDailySummaryDate">> & {
    maxCoversPerSlot: number | null;
    policiesText: string | null;
    slotDiscounts: NonNullable<ReservationSettings["slotDiscounts"]>;
    lastDailySummaryDate: string | null;
};
export declare function normalizeReservationSettings(raw: ReservationSettings | null | undefined): typeof DEFAULT_RESERVATION_SETTINGS;
/** Fix autoAccept default: when undefined, false (manual confirmation). */
export declare function resolveSettings(raw: ReservationSettings | null | undefined): Required<Omit<schema.ReservationSettings, "maxCoversPerSlot" | "policiesText" | "slotDiscounts" | "lastDailySummaryDate">> & {
    maxCoversPerSlot: number | null;
    policiesText: string | null;
    slotDiscounts: NonNullable<ReservationSettings["slotDiscounts"]>;
    lastDailySummaryDate: string | null;
};
export declare function resolveDineInHours(storeHours: StoreHours | null | undefined, settings: ReturnType<typeof resolveSettings>): ChannelHours;
/** Build a Date for a Zurich wall-clock YYYY-MM-DD + HH:mm */
export declare function zurichLocalToDate(dateStr: string, hm: string): Date;
export declare class ReservationService {
    static getSettingsForMerchant(merchant: {
        reservationsEnabled?: boolean | null;
        reservationSettings?: ReservationSettings | null;
        storeHours?: StoreHours | null;
        dineInEnabled?: boolean | null;
        name?: string | null;
        address?: string | null;
        city?: string | null;
        phone?: string | null;
        email?: string | null;
    }): {
        enabled: boolean;
        dineInEnabled: boolean;
        settings: Required<Omit<schema.ReservationSettings, "maxCoversPerSlot" | "policiesText" | "slotDiscounts" | "lastDailySummaryDate">> & {
            maxCoversPerSlot: number | null;
            policiesText: string | null;
            slotDiscounts: NonNullable<ReservationSettings["slotDiscounts"]>;
            lastDailySummaryDate: string | null;
        };
        hours: Partial<Record<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat", HoursSlot[]>>;
        shopName: string;
        address: string;
        phone: string | null;
        email: string | null;
    };
    static getConfig(merchantId: string): Promise<{
        enabled: boolean;
        dineInEnabled: boolean;
        settings: Required<Omit<schema.ReservationSettings, "maxCoversPerSlot" | "policiesText" | "slotDiscounts" | "lastDailySummaryDate">> & {
            maxCoversPerSlot: number | null;
            policiesText: string | null;
            slotDiscounts: NonNullable<ReservationSettings["slotDiscounts"]>;
            lastDailySummaryDate: string | null;
        };
        hours: Partial<Record<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat", HoursSlot[]>>;
        shopName: string;
        address: string;
        phone: string | null;
        email: string | null;
    }>;
    static updateSettings(merchantId: string, input: {
        enabled?: boolean;
        settings?: Partial<ReservationSettings>;
        /** Optional: write custom dine_in hours when mode is custom */
        dineInHours?: ChannelHours;
        storeHoursPatch?: boolean;
    }): Promise<{
        enabled: boolean;
        dineInEnabled: boolean;
        settings: Required<Omit<schema.ReservationSettings, "maxCoversPerSlot" | "policiesText" | "slotDiscounts" | "lastDailySummaryDate">> & {
            maxCoversPerSlot: number | null;
            policiesText: string | null;
            slotDiscounts: NonNullable<ReservationSettings["slotDiscounts"]>;
            lastDailySummaryDate: string | null;
        };
        hours: Partial<Record<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat", HoursSlot[]>>;
        shopName: string;
        address: string;
        phone: string | null;
        email: string | null;
    }>;
    static totalTableCapacity(merchantId: string): Promise<number>;
    static listOverlapping(merchantId: string, start: Date, end: Date, excludeId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        customerId: string | null;
        notes: string | null;
        tableId: string | null;
        tableLabel: string | null;
        cancelledAt: Date | null;
        code: string;
        guestName: string;
        guestEmail: string | null;
        guestPhone: string;
        partySize: number;
        reservedAt: Date;
        durationMinutes: number;
        discountPercent: number | null;
        discountLabel: string | null;
        internalNotes: string | null;
        source: string;
        confirmationSentAt: Date | null;
        reminderSentAt: Date | null;
        acceptedAt: Date | null;
        seatedAt: Date | null;
    }[]>;
    static getSlots(merchantId: string, dateYmd: string, partySize: number): Promise<{
        date: string;
        partySize: number;
        slots: Array<{
            time: string;
            available: boolean;
            remainingCovers: number;
            discountPercent?: number;
            discountLabel?: string | null;
        }>;
        settings?: undefined;
    } | {
        date: string;
        partySize: number;
        slots: {
            time: string;
            available: boolean;
            remainingCovers: number;
            discountPercent?: number;
            discountLabel?: string | null;
        }[];
        settings: {
            slotIntervalMinutes: number;
            seatingDurationMinutes: number;
            bufferMinutes: number;
            minHoursBefore: number;
            maxDaysAhead: number;
        };
    }>;
    static create(merchantId: string, input: {
        guestName: string;
        guestEmail?: string | null;
        guestPhone: string;
        partySize: number;
        reservedAt: Date | string;
        notes?: string | null;
        source?: string;
        customerId?: string | null;
        tableId?: string | null;
        status?: ReservationStatus;
        skipSlotCheck?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        customerId: string | null;
        notes: string | null;
        tableId: string | null;
        tableLabel: string | null;
        cancelledAt: Date | null;
        code: string;
        guestName: string;
        guestEmail: string | null;
        guestPhone: string;
        partySize: number;
        reservedAt: Date;
        durationMinutes: number;
        discountPercent: number | null;
        discountLabel: string | null;
        internalNotes: string | null;
        source: string;
        confirmationSentAt: Date | null;
        reminderSentAt: Date | null;
        acceptedAt: Date | null;
        seatedAt: Date | null;
    }>;
    /** WebPOS auto-print + alert via floor print job queue. */
    static enqueuePosAlert(merchantId: string, reservationId: string): Promise<void>;
    static list(merchantId: string, opts?: {
        from?: Date;
        to?: Date;
        status?: string;
        limit?: number;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        customerId: string | null;
        notes: string | null;
        tableId: string | null;
        tableLabel: string | null;
        cancelledAt: Date | null;
        code: string;
        guestName: string;
        guestEmail: string | null;
        guestPhone: string;
        partySize: number;
        reservedAt: Date;
        durationMinutes: number;
        discountPercent: number | null;
        discountLabel: string | null;
        internalNotes: string | null;
        source: string;
        confirmationSentAt: Date | null;
        reminderSentAt: Date | null;
        acceptedAt: Date | null;
        seatedAt: Date | null;
    }[]>;
    static listForSync(merchantId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        customerId: string | null;
        notes: string | null;
        tableId: string | null;
        tableLabel: string | null;
        cancelledAt: Date | null;
        code: string;
        guestName: string;
        guestEmail: string | null;
        guestPhone: string;
        partySize: number;
        reservedAt: Date;
        durationMinutes: number;
        discountPercent: number | null;
        discountLabel: string | null;
        internalNotes: string | null;
        source: string;
        confirmationSentAt: Date | null;
        reminderSentAt: Date | null;
        acceptedAt: Date | null;
        seatedAt: Date | null;
    }[]>;
    static get(merchantId: string, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        merchantId: string;
        customerId: string | null;
        notes: string | null;
        tableId: string | null;
        tableLabel: string | null;
        cancelledAt: Date | null;
        code: string;
        guestName: string;
        guestEmail: string | null;
        guestPhone: string;
        partySize: number;
        reservedAt: Date;
        durationMinutes: number;
        discountPercent: number | null;
        discountLabel: string | null;
        internalNotes: string | null;
        source: string;
        confirmationSentAt: Date | null;
        reminderSentAt: Date | null;
        acceptedAt: Date | null;
        seatedAt: Date | null;
    }>;
    static action(merchantId: string, id: string, action: "accept" | "reject" | "seat" | "complete" | "cancel" | "no_show" | "assign_table" | "unassign_table", payload?: {
        tableId?: string | null;
        internalNotes?: string | null;
        cancelReason?: string | null;
        sendRejectionEmail?: boolean;
    }): Promise<{
        id: string;
        merchantId: string;
        code: string;
        customerId: string | null;
        guestName: string;
        guestEmail: string | null;
        guestPhone: string;
        partySize: number;
        reservedAt: Date;
        durationMinutes: number;
        status: string;
        tableId: string | null;
        tableLabel: string | null;
        discountPercent: number | null;
        discountLabel: string | null;
        notes: string | null;
        internalNotes: string | null;
        source: string;
        confirmationSentAt: Date | null;
        reminderSentAt: Date | null;
        acceptedAt: Date | null;
        seatedAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static update(merchantId: string, id: string, input: {
        guestName?: string;
        guestEmail?: string | null;
        guestPhone?: string;
        partySize?: number;
        reservedAt?: Date | string;
        date?: string;
        time?: string;
        notes?: string | null;
        internalNotes?: string | null;
        tableId?: string | null;
    }): Promise<{
        id: string;
        merchantId: string;
        code: string;
        customerId: string | null;
        guestName: string;
        guestEmail: string | null;
        guestPhone: string;
        partySize: number;
        reservedAt: Date;
        durationMinutes: number;
        status: string;
        tableId: string | null;
        tableLabel: string | null;
        discountPercent: number | null;
        discountLabel: string | null;
        notes: string | null;
        internalNotes: string | null;
        source: string;
        confirmationSentAt: Date | null;
        reminderSentAt: Date | null;
        acceptedAt: Date | null;
        seatedAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static sendLifecycleEmail(merchant: {
        id?: string;
        name?: string | null;
        email?: string | null;
        address?: string | null;
        city?: string | null;
        phone?: string | null;
        shopLanguage?: string | null;
        panelLanguage?: string | null;
        reservationSettings?: ReservationSettings | null;
    }, reservation: typeof schema.reservations.$inferSelect, kind: "received" | "confirmed" | "rejected" | "cancelled" | "seated" | "reminder"): Promise<void>;
    /** Notify the restaurant (merchant account email) about a booking event. */
    static sendAdminNotifyEmail(merchant: {
        id?: string;
        name?: string | null;
        email?: string | null;
        reservationSettings?: ReservationSettings | null;
    }, reservation: typeof schema.reservations.$inferSelect, kind: "received" | "confirmed" | "rejected" | "cancelled" | "seated" | "reminder"): Promise<void>;
    /** Hourly: email guests before their reservation (pending/confirmed). */
    static processReminders(): Promise<{
        sent: number;
    }>;
    /**
     * After 10:00 Europe/Zurich each day, email the merchant a lunch/dinner
     * summary of today's reservations (once per calendar day).
     */
    static processDailySummaries(): Promise<{
        sent: number;
    }>;
}
//# sourceMappingURL=reservation.service.d.ts.map