import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  emailMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailMessage', default: null },
  messageId: { type: String, default: '' },
  sender: { type: String, default: '' },
  subject: { type: String, default: '' },
  summary: { type: String, default: '' },
  priority: { type: String, enum: ['must', 'should', 'nice', 'skip'], default: 'should' },
  nextAction: { type: String, enum: ['reply', 'routine', 'task', 'review'], default: 'review' },
  rationale: { type: String, default: '' },
  routineSuggestion: { type: String, default: '' }
}, { _id: false });

const inboxBriefingSchema = new mongoose.Schema({
  runDate: { type: Date, required: true, default: Date.now },
  londonDate: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['success', 'partial', 'failed'], default: 'success' },
  source: { type: String, enum: ['gmail'], default: 'gmail' },
  query: { type: String, default: '' },
  summary: { type: String, default: '' },
  topPriorities: [itemSchema],
  routines: [itemSchema],
  followUps: [itemSchema],
  reviewLater: [itemSchema],
  createdTaskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  fetchedCount: { type: Number, default: 0 },
  briefedCount: { type: Number, default: 0 },
  warnings: [{ type: String }],
  errors: [{ type: String }]
}, { timestamps: true, suppressReservedKeysWarning: true });

inboxBriefingSchema.pre('validate', function setLondonDate(next) {
  if (this.runDate) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = Object.fromEntries(formatter.formatToParts(this.runDate).map((part) => [part.type, part.value]));
    this.londonDate = `${parts.year}-${parts.month}-${parts.day}`;
  }
  next();
});

inboxBriefingSchema.index({ runDate: -1, createdAt: -1 });
inboxBriefingSchema.index({ londonDate: 1, createdAt: -1 });

export const InboxBriefing = mongoose.model('InboxBriefing', inboxBriefingSchema);
