import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', required: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  contextUsed: { type: mongoose.Schema.Types.Mixed, default: {} },
  model: { type: String, default: '' },
  provider: { type: String, default: 'huggingface' },
  error: { type: String, default: '' },
}, { timestamps: true });

chatMessageSchema.index({ conversationId: 1, createdAt: 1 });
chatMessageSchema.index({ createdAt: -1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
