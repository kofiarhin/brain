import { Router } from 'express';
import { listChatConversations, listChatMessages, sendChatMessage } from '../controllers/chatController.js';
import { chatRateLimit } from '../middleware/chatRateLimit.js';

const router = Router();

router.get('/conversations', listChatConversations);
router.get('/conversations/:id/messages', listChatMessages);
router.post('/', chatRateLimit, sendChatMessage);

export default router;
