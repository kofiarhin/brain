import mongoose from 'mongoose';
import { ChatConversation } from '../models/ChatConversation.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { buildBrainContext } from '../services/brainContextBuilder.js';
import { buildChatPrompt } from '../services/chatPrompt.js';
import { generateChatCompletion, HuggingFaceProviderError } from '../services/huggingFaceClient.js';

function titleFrom(message) { return (message || '').slice(0, 60).trim() || 'New Chat'; }
function isValidId(id) { return !id || mongoose.Types.ObjectId.isValid(id) || typeof id === 'string'; }

export async function sendChatMessage(req, res, next) {
  try {
    const message = String(req.body?.message || '').trim();
    const { conversationId } = req.body || {};
    if (!message) return res.status(400).json({ message: 'Message is required' });
    if (conversationId && !isValidId(conversationId)) return res.status(404).json({ message: 'Conversation not found' });

    let conversation = conversationId ? await ChatConversation.findById(conversationId) : null;
    if (conversationId && !conversation) return res.status(404).json({ message: 'Conversation not found' });
    if (!conversation) conversation = await ChatConversation.create({ title: titleFrom(message), lastMessageAt: new Date() });

    await ChatMessage.create({ conversationId: conversation._id, role: 'user', content: message, provider: '' });
    const contextBundle = await buildBrainContext({ message, conversationId: conversation._id });
    const prompt = buildChatPrompt({ message, contextBundle });
    const content = await generateChatCompletion({ prompt });
    const assistantMessage = await ChatMessage.create({
      conversationId: conversation._id,
      role: 'assistant',
      content,
      contextUsed: contextBundle.contextUsed,
      model: process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3',
      provider: 'huggingface',
    });
    await ChatConversation.findByIdAndUpdate(conversation._id, { lastMessageAt: new Date(), contextSnapshotSummary: JSON.stringify(contextBundle.contextUsed) });
    return res.json({
      conversationId: String(conversation._id),
      message: { role: assistantMessage.role, content: assistantMessage.content, createdAt: assistantMessage.createdAt },
      contextUsed: contextBundle.contextUsed,
    });
  } catch (error) {
    if (error instanceof HuggingFaceProviderError) return res.status(502).json({ message: 'Brain chat is temporarily unavailable' });
    return next(error);
  }
}

export async function listChatConversations(_req, res, next) {
  try {
    const conversations = await ChatConversation.find({ archivedAt: null }).sort({ lastMessageAt: -1 }).limit(50);
    return res.json(conversations);
  } catch (error) { return next(error); }
}

export async function listChatMessages(req, res, next) {
  try {
    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    const messages = await ChatMessage.find({ conversationId: req.params.id }).sort({ createdAt: 1 }).limit(100);
    return res.json(messages);
  } catch (error) { return next(error); }
}
