"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const platform_message_service_1 = require("@/services/platform-message.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
/**
 * GET /api/panel/messages
 * Active undismissed messages for the current panel user.
 */
router.get('/messages', async (req, res) => {
    try {
        const viewer = platform_message_service_1.PlatformMessageService.resolveViewer(req.user);
        if (!viewer)
            return res.status(403).json({ error: 'Unsupported role' });
        const data = await platform_message_service_1.PlatformMessageService.getActiveForViewer(viewer);
        res.json({ success: true, ...data });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load messages' });
    }
});
/**
 * POST /api/panel/messages/:messageId/dismiss
 */
router.post('/messages/:messageId/dismiss', async (req, res) => {
    try {
        const viewer = platform_message_service_1.PlatformMessageService.resolveViewer(req.user);
        if (!viewer)
            return res.status(403).json({ error: 'Unsupported role' });
        await platform_message_service_1.PlatformMessageService.dismiss(viewer, req.params.messageId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to dismiss' });
    }
});
/**
 * POST /api/panel/messages/dismiss-all
 */
router.post('/messages/dismiss-all', async (req, res) => {
    try {
        const viewer = platform_message_service_1.PlatformMessageService.resolveViewer(req.user);
        if (!viewer)
            return res.status(403).json({ error: 'Unsupported role' });
        const ids = Array.isArray(req.body?.messageIds)
            ? req.body.messageIds.map(String).filter(Boolean)
            : [];
        await platform_message_service_1.PlatformMessageService.dismissAll(viewer, ids);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to dismiss all' });
    }
});
exports.default = router;
//# sourceMappingURL=panel.routes.js.map