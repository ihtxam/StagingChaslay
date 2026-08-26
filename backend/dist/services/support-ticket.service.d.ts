export declare function saveSupportAttachment(opts: {
    merchantId: string;
    ticketId: string;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
}): Promise<{
    url: string;
    name: string;
}>;
export declare class SupportTicketService {
    /** Close tickets older than 3 days. */
    static autoCloseExpired(ticketIds?: string[]): Promise<number>;
    static createTicket(merchantId: string, input: {
        category: string;
        subcategory?: string;
        subject: string;
        body: string;
        attachment?: {
            url: string;
            name: string;
        } | null;
        authorName?: string;
        authorId?: string;
        /** Superadmin-only tickets (POS diagnostic logs). Default true. */
        merchantVisible?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        resellerId: string | null;
        merchantId: string;
        category: string;
        subject: string;
        closedAt: Date | null;
        ticketNumber: string;
        subcategory: string | null;
        merchantVisible: boolean;
        assignedToSuperadminId: string | null;
        lastMessageAt: Date;
        autoCloseAt: Date;
    }>;
    /** Internal POS/Web diagnostic report — platform System Logs only (not support inbox). */
    static createDiagnosticReport(merchantId: string, input: {
        source: 'webpos' | 'android';
        subject: string;
        body: string;
        auto?: boolean;
        authorName?: string;
        actorId?: string | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        resellerId: string | null;
        merchantId: string | null;
        message: string;
        category: string;
        level: string;
        metadata: Record<string, unknown> | null;
        actorRole: string | null;
        actorId: string | null;
    }>;
    static setFirstMessageAttachment(ticketId: string, attachment: {
        url: string;
        name: string;
    }): Promise<void>;
    static listMerchantTickets(merchantId: string, status?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        resellerId: string | null;
        merchantId: string;
        category: string;
        subject: string;
        closedAt: Date | null;
        ticketNumber: string;
        subcategory: string | null;
        merchantVisible: boolean;
        assignedToSuperadminId: string | null;
        lastMessageAt: Date;
        autoCloseAt: Date;
    }[]>;
    static listResellerTickets(resellerId: string, status?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        resellerId: string | null;
        merchantId: string;
        category: string;
        subject: string;
        closedAt: Date | null;
        ticketNumber: string;
        subcategory: string | null;
        merchantVisible: boolean;
        assignedToSuperadminId: string | null;
        lastMessageAt: Date;
        autoCloseAt: Date;
        merchant: {
            id: string;
            name: string;
            email: string;
        };
    }[]>;
    static listAllTickets(opts?: {
        status?: string;
        category?: string;
        assignedTo?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        resellerId: string | null;
        merchantId: string;
        category: string;
        subject: string;
        closedAt: Date | null;
        ticketNumber: string;
        subcategory: string | null;
        merchantVisible: boolean;
        assignedToSuperadminId: string | null;
        lastMessageAt: Date;
        autoCloseAt: Date;
        merchant: {
            id: string;
            name: string;
            email: string;
        };
        reseller: {
            id: string;
            name: string;
        } | null;
    }[]>;
    static getTicketWithMessages(ticketId: string, scope?: {
        merchantId?: string;
        resellerId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        resellerId: string | null;
        merchantId: string;
        category: string;
        subject: string;
        closedAt: Date | null;
        ticketNumber: string;
        subcategory: string | null;
        merchantVisible: boolean;
        assignedToSuperadminId: string | null;
        lastMessageAt: Date;
        autoCloseAt: Date;
        merchant: {
            id: string;
            name: string;
            email: string;
        };
        reseller: {
            id: string;
            name: string;
        } | null;
        messages: {
            id: string;
            createdAt: Date;
            ticketId: string;
            body: string;
            authorRole: string;
            authorId: string | null;
            authorName: string | null;
            attachmentUrl: string | null;
            attachmentName: string | null;
        }[];
    }>;
    static addReply(ticketId: string, input: {
        authorRole: 'merchant' | 'reseller' | 'superadmin' | 'system';
        authorId?: string;
        authorName?: string;
        body: string;
        attachment?: {
            url: string;
            name: string;
        } | null;
        closeTicket?: boolean;
    }, scope?: {
        merchantId?: string;
        resellerId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        resellerId: string | null;
        merchantId: string;
        category: string;
        subject: string;
        closedAt: Date | null;
        ticketNumber: string;
        subcategory: string | null;
        merchantVisible: boolean;
        assignedToSuperadminId: string | null;
        lastMessageAt: Date;
        autoCloseAt: Date;
        merchant: {
            id: string;
            name: string;
            email: string;
        };
        reseller: {
            id: string;
            name: string;
        } | null;
        messages: {
            id: string;
            createdAt: Date;
            ticketId: string;
            body: string;
            authorRole: string;
            authorId: string | null;
            authorName: string | null;
            attachmentUrl: string | null;
            attachmentName: string | null;
        }[];
    }>;
    static assignTicket(ticketId: string, superadminId: string | null): Promise<{
        id: string;
        ticketNumber: string;
        merchantId: string;
        resellerId: string | null;
        category: string;
        subcategory: string | null;
        subject: string;
        status: string;
        merchantVisible: boolean;
        assignedToSuperadminId: string | null;
        lastMessageAt: Date;
        closedAt: Date | null;
        autoCloseAt: Date;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static listSupportAgents(): Promise<{
        id: string;
        name: string;
        email: string;
        handlesSupport: boolean;
    }[]>;
    static setSupportAgent(superadminId: string, handlesSupport: boolean): Promise<{
        id: string;
        name: string;
        email: string;
        handlesSupport: boolean;
    }>;
    static listSuperadminsForSupportMgmt(): Promise<{
        id: string;
        name: string;
        email: string;
        role: string;
        handlesSupport: boolean;
    }[]>;
}
//# sourceMappingURL=support-ticket.service.d.ts.map