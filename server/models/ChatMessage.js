import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', required: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  contextUsed: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Grounding metadata for the answer. Without an explicit path here, Mongoose's
  // default strict mode silently drops the field on write, leaving persisted
  // history unable to show whether an answer was vector-grounded or degraded.
  // Only IDs, scores and mode are stored — never raw vectors or note content.
  retrieval: {
    type: new mongoose.Schema({
      mode: { type: String, default: 'none' },
      candidateCount: { type: Number, default: 0 },
      selectedCount: { type: Number, default: 0 },
      embeddingModel: { type: String, default: '' },
      rerankModel: { type: String, default: '' },
      degraded: { type: Boolean, default: false },
      degradedReason: { type: String, default: '' },
      sources: {
        type: [new mongoose.Schema({
          type: { type: String, default: 'note' },
          id: { type: String, default: '' },
          score: { type: Number, default: 0 },
        }, { _id: false })],
        default: [],
      },
    }, { _id: false }),
    default: undefined,
  },
  model: { type: String, default: '' },
  provider: { type: String, default: '' },
  error: { type: String, default: '' },
}, { timestamps: true });

chatMessageSchema.index({ conversationId: 1, createdAt: 1 });
chatMessageSchema.index({ createdAt: -1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
