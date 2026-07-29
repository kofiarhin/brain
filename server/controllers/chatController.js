import mongoose from 'mongoose';
import { ChatConversation } from '../models/ChatConversation.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { buildBrainContext } from '../services/brainContextBuilder.js';
import { buildChatPrompt } from '../services/chatPrompt.js';
import { generateChatCompletion, NvidiaProviderError } from '../services/nvidiaClient.js';
import { getAiConfig } from '../config/ai.js';
import { buildLocalChatFallback } from '../services/localChatFallback.js';

function titleFrom(message) {
  return (message || '').slice(0, 60).trim() || 'New Chat';
}

function isValidId(id) {
  return !id || mongoose.Types.ObjectId.isValid(id);
}

function serializeMessage(message, extras = {}) {
  return {
    _id: String(message._id),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...extras,
  };
}

export async function sendChatMessage(req, res, next) {
  try {
    const message = String(req.body?.message || '').trim();
    const { conversationId } = req.body || {};
    if (!message) return res.status(400).json({ message: 'Message is required' });
    if (conversationId && !isValidId(conversationId)) return res.status(404).json({ message: 'Conversation not found' });

    let conversation = conversationId ? await ChatConversation.findById(conversationId) : null;
    if (conversationId && !conversation) return res.status(404).json({ message: 'Conversation not found' });
    if (!conversation) conversation = await ChatConversation.create({ title: titleFrom(message), lastMessageAt: new Date() });

    const userMessage = await ChatMessage.create({ conversationId: conversation._id, role: 'user', content: message, provider: '' });
    const contextBundle = await buildBrainContext({ message, conversationId: conversation._id });
    const prompt = buildChatPrompt({ message, contextBundle });
    let content;
    let provider = 'nvidia';
    let model = getAiConfig().chatModel;

    try {
      content = await generateChatCompletion({
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        maxTokens: getAiConfig().maxAnswerTokens,
      });
    } catch (error) {
      if (!(error instanceof NvidiaProviderError)) throw error;
      console.warn(`Brain chat provider unavailable: ${error.message}`);
      content = buildLocalChatFallback({ message, contextBundle });
      provider = 'local-fallback';
      model = 'local-context-summary';
    }

    // Grounding metadata is built once and used for both the persisted record and
    // the response, so stored history cannot disagree with what the client was told.
    const retrieval = {
      ...contextBundle.retrieval,
      sources: (contextBundle.relevantNotes || []).map((note) => ({
        type: 'note', id: String(note.id || note._id), score: Number(note.score || 0),
      })),
    };

    const assistantMessage = await ChatMessage.create({
      conversationId: conversation._id,
      role: 'assistant',
      content,
      contextUsed: contextBundle.contextUsed,
      retrieval,
      model,
      provider,
    });
    await ChatConversation.findByIdAndUpdate(conversation._id, { lastMessageAt: new Date(), contextSnapshotSummary: JSON.stringify(contextBundle.contextUsed) });

    return res.json({
      conversationId: String(conversation._id),
      userMessage: serializeMessage(userMessage),
      message: serializeMessage(assistantMessage, {
        contextUsed: contextBundle.contextUsed,
        retrieval,
      }),
      contextUsed: contextBundle.contextUsed,
      retrieval,
    });
  } catch (error) {
    return next(error);
  }
}

export async function listChatConversations(_req, res, next) {
  try {
    const conversations = await ChatConversation.find({ archivedAt: null }).sort({ lastMessageAt: -1 }).limit(50);
    return res.json(conversations);
  } catch (error) {
    return next(error);
  }
}

export async function listChatMessages(req, res, next) {
  try {
    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    // Fetch the newest window, then restore chronological order for rendering.
    const latestMessages = await ChatMessage.find({ conversationId: req.params.id }).sort({ createdAt: -1 }).limit(100);
    return res.json([...latestMessages].reverse());
  } catch (error) {
    return next(error);
  }
}
