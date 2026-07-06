import { Router } from 'express';
import { listChatConversations, listChatMessages, sendChatMessage } from '../controllers/chatController.js';

const router = Router();

router.get('/conversations', listChatConversations);
router.get('/conversations/:id/messages', listChatMessages);
router.post('/', sendChatMessage);

export default router;
