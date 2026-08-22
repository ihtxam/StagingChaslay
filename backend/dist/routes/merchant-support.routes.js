"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("@/middleware/auth.middleware");
const support_ticket_service_1 = require("@/services/support-ticket.service");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
});
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
router.get('/tickets', async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const status = String(req.query.status || 'all');
        const tickets = await support_ticket_service_1.SupportTicketService.listMerchantTickets(merchantId, status);
        res.json({ success: true, tickets });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list tickets' });
    }
});
router.get('/tickets/:ticketId', async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const ticket = await support_ticket_service_1.SupportTicketService.getTicketWithMessages(req.params.ticketId, { merchantId });
        res.json({ success: true, ticket });
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : 'Ticket not found' });
    }
});
router.post('/tickets', upload.single('attachment'), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { category, subcategory, subject, body } = req.body || {};
        if (!subject?.trim() || !body?.trim()) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }
        let attachment = null;
        const ticketDraft = await support_ticket_service_1.SupportTicketService.createTicket(merchantId, {
            category: category || 'technical',
            subcategory,
            subject,
            body,
            authorName: req.user?.name,
            authorId: req.user?.staffId || req.user?.id,
        });
        if (req.file?.buffer) {
            attachment = await (0, support_ticket_service_1.saveSupportAttachment)({
                merchantId,
                ticketId: ticketDraft.id,
                buffer: req.file.buffer,
                mimeType: req.file.mimetype,
                originalName: req.file.originalname,
            });
            await support_ticket_service_1.SupportTicketService.setFirstMessageAttachment(ticketDraft.id, attachment);
        }
        const full = await support_ticket_service_1.SupportTicketService.getTicketWithMessages(ticketDraft.id, { merchantId });
        res.status(201).json({ success: true, ticket: full });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create ticket' });
    }
});
router.post('/tickets/:ticketId/reply', upload.single('attachment'), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const body = String(req.body?.body || '').trim();
        if (!body && !req.file) {
            return res.status(400).json({ error: 'Message is required' });
        }
        let attachment = null;
        if (req.file?.buffer) {
            attachment = await (0, support_ticket_service_1.saveSupportAttachment)({
                merchantId,
                ticketId: req.params.ticketId,
                buffer: req.file.buffer,
                mimeType: req.file.mimetype,
                originalName: req.file.originalname,
            });
        }
        const ticket = await support_ticket_service_1.SupportTicketService.addReply(req.params.ticketId, {
            authorRole: 'merchant',
            authorId: req.user?.staffId || req.user?.id,
            authorName: req.user?.name,
            body: body || '(attachment)',
            attachment,
        }, { merchantId });
        res.json({ success: true, ticket });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to send reply' });
    }
});
exports.default = router;
//# sourceMappingURL=merchant-support.routes.js.map