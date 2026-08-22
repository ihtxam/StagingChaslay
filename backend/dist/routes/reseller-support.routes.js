"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const support_ticket_service_1 = require("@/services/support-ticket.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireReseller);
router.get('/tickets', async (req, res) => {
    try {
        const resellerId = req.user.resellerId;
        const status = String(req.query.status || 'all');
        const tickets = await support_ticket_service_1.SupportTicketService.listResellerTickets(resellerId, status);
        res.json({ success: true, tickets });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list tickets' });
    }
});
router.get('/tickets/:ticketId', async (req, res) => {
    try {
        const resellerId = req.user.resellerId;
        const ticket = await support_ticket_service_1.SupportTicketService.getTicketWithMessages(req.params.ticketId, { resellerId });
        res.json({ success: true, ticket });
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : 'Ticket not found' });
    }
});
router.post('/tickets/:ticketId/reply', async (req, res) => {
    try {
        const resellerId = req.user.resellerId;
        const body = String(req.body?.body || '').trim();
        if (!body)
            return res.status(400).json({ error: 'Message is required' });
        const ticket = await support_ticket_service_1.SupportTicketService.addReply(req.params.ticketId, {
            authorRole: 'reseller',
            authorId: resellerId,
            authorName: req.user?.name,
            body,
            closeTicket: !!req.body?.close,
        }, { resellerId });
        res.json({ success: true, ticket });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to reply' });
    }
});
exports.default = router;
//# sourceMappingURL=reseller-support.routes.js.map