import mongoose from 'mongoose';

const chatConversationSchema = new mongoose.Schema({
  title: { type: String, default: 'New Chat', trim: true },
  summary: { type: String, default: '', trim: true },
  lastMessageAt: { type: Date, default: Date.now },
  contextSnapshotSummary: { type: String, default: '', trim: true },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

chatConversationSchema.index({ lastMessageAt: -1 });
chatConversationSchema.index({ archivedAt: 1, lastMessageAt: -1 });

export const ChatConversation = mongoose.model('ChatConversation', chatConversationSchema);
