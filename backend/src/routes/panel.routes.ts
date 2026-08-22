import { Router, Request, Response } from 'express';
import { verifyToken } from '@/middleware/auth.middleware';
import { PlatformMessageService } from '@/services/platform-message.service';

const router = Router();

router.use(verifyToken);

/**
 * GET /api/panel/messages
 * Active undismissed messages for the current panel user.
 */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const viewer = PlatformMessageService.resolveViewer(req.user);
    if (!viewer) return res.status(403).json({ error: 'Unsupported role' });
    const data = await PlatformMessageService.getActiveForViewer(viewer);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load messages' });
  }
});

/**
 * POST /api/panel/messages/:messageId/dismiss
 */
router.post('/messages/:messageId/dismiss', async (req: Request, res: Response) => {
  try {
    const viewer = PlatformMessageService.resolveViewer(req.user);
    if (!viewer) return res.status(403).json({ error: 'Unsupported role' });
    await PlatformMessageService.dismiss(viewer, req.params.messageId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to dismiss' });
  }
});

/**
 * POST /api/panel/messages/dismiss-all
 */
router.post('/messages/dismiss-all', async (req: Request, res: Response) => {
  try {
    const viewer = PlatformMessageService.resolveViewer(req.user);
    if (!viewer) return res.status(403).json({ error: 'Unsupported role' });
    const ids = Array.isArray(req.body?.messageIds)
      ? req.body.messageIds.map(String).filter(Boolean)
      : [];
    await PlatformMessageService.dismissAll(viewer, ids);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to dismiss all' });
  }
});

export default router;
