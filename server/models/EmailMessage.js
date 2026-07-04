import mongoose from 'mongoose';

const emailMessageSchema = new mongoose.Schema({
  provider: { type: String, enum: ['gmail'], default: 'gmail' },
  messageId: { type: String, required: true, trim: true },
  threadId: { type: String, trim: true, default: '' },
  historyId: { type: String, trim: true, default: '' },
  from: { type: String, trim: true, default: '' },
  to: { type: String, trim: true, default: '' },
  subject: { type: String, trim: true, default: '' },
  snippet: { type: String, default: '' },
  labelIds: [{ type: String }],
  receivedAt: { type: Date, default: null },
  internalDate: { type: Number, default: null },
  isUnread: { type: Boolean, default: false },
  importanceScore: { type: Number, min: 0, max: 100, default: 0 },
  priority: { type: String, enum: ['must', 'should', 'nice', 'skip'], default: 'should' },
  nextAction: { type: String, enum: ['reply', 'routine', 'task', 'review', 'archive', 'skip'], default: 'review' },
  actionSummary: { type: String, default: '' },
  replyDraft: { type: String, default: '' },
  routineSuggestion: { type: String, default: '' },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  status: { type: String, enum: ['new', 'briefed', 'task_created', 'dismissed', 'archived'], default: 'new' },
  lastFetchedAt: { type: Date, default: Date.now }
}, { timestamps: true });

emailMessageSchema.index({ provider: 1, messageId: 1 }, { unique: true });
emailMessageSchema.index({ receivedAt: -1, priority: 1 });
emailMessageSchema.index({ status: 1, receivedAt: -1 });

export const EmailMessage = mongoose.model('EmailMessage', emailMessageSchema);
