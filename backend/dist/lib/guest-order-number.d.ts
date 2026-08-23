export declare function parseOrderMetaFromNotes(notes?: string | null): {
    ticketDisplay?: string;
    tabNumber?: string;
};
export declare function guestOrderNumber(opts: {
    orderNumber?: string | null;
    orderDisplay?: string | null;
    tabNumber?: string | null;
}): string;
