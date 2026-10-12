import { Router, Request, Response } from 'express';
import multer from 'multer';
import { verifyToken, requireReseller } from '@/middleware/auth.middleware';
import { SupportTicketService, saveSupportAttachment } from '@/services/support-ticket.service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.use(verifyToken);
router.use(requireReseller);

router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const resellerId = req.user!.resellerId!;
    const status = String(req.query.status || 'all');
    const tickets = await SupportTicketService.listResellerTickets(resellerId, status);
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list tickets' });
  }
});

router.get('/tickets/:ticketId', async (req: Request, res: Response) => {
  try {
    const resellerId = req.user!.resellerId!;
    const ticket = await SupportTicketService.getTicketWithMessages(req.params.ticketId, { resellerId });
    try {
      const { PlatformMessageService } = await import('@/services/platform-message.service');
      await PlatformMessageService.acknowledgeResellerTicketAlert(resellerId, ticket.id);
    } catch (ackErr) {
      console.warn('[support] reseller ticket alert ack failed:', ackErr);
    }
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Ticket not found' });
  }
});

router.post('/tickets', upload.single('attachment'), async (req: Request, res: Response) => {
  try {
    const resellerId = req.user!.resellerId!;
    const { category, subcategory, subject, body } = req.body || {};
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const ticketDraft = await SupportTicketService.createResellerTicket(resellerId, {
      category: category || 'technical',
      subcategory,
      subject,
      body,
      authorName: req.user?.name,
      authorId: req.user?.id,
    });

    if (req.file?.buffer) {
      const attachment = await saveSupportAttachment({
        resellerId,
        ticketId: ticketDraft.id,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
      });
      await SupportTicketService.setFirstMessageAttachment(ticketDraft.id, attachment);
    }

    const full = await SupportTicketService.getTicketWithMessages(ticketDraft.id, { resellerId });
    res.status(201).json({ success: true, ticket: full });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create ticket' });
  }
});

router.post('/tickets/:ticketId/reply', upload.single('attachment'), async (req: Request, res: Response) => {
  try {
    const resellerId = req.user!.resellerId!;
    const body = String(req.body?.body || '').trim();
    if (!body && !req.file) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let attachment: { url: string; name: string } | null = null;
    if (req.file?.buffer) {
      attachment = await saveSupportAttachment({
        resellerId,
        ticketId: req.params.ticketId,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
      });
    }

    const ticket = await SupportTicketService.addReply(
      req.params.ticketId,
      {
        authorRole: 'reseller',
        authorId: resellerId,
        authorName: req.user?.name,
        body: body || '(attachment)',
        attachment,
        closeTicket: !!req.body?.close,
      },
      { resellerId }
    );
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to reply' });
  }
});

export default router;
