import { Router, Request, Response } from 'express';
import { verifyToken, requireReseller } from '@/middleware/auth.middleware';
import { SupportTicketService } from '@/services/support-ticket.service';

const router = Router();

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
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : 'Ticket not found' });
  }
});

router.post('/tickets/:ticketId/reply', async (req: Request, res: Response) => {
  try {
    const resellerId = req.user!.resellerId!;
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Message is required' });

    const ticket = await SupportTicketService.addReply(
      req.params.ticketId,
      {
        authorRole: 'reseller',
        authorId: resellerId,
        authorName: req.user?.name,
        body,
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
