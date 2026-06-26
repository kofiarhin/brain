import mongoose from 'mongoose';

const dayPlanSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  londonDate: { type: String, trim: true },
  startTime: { type: Date, default: null },
  endTime: { type: Date, default: null },
  status: {
    type: String,
    enum: ['active', 'completed', 'restarted', 'archived'],
    default: 'active'
  },
  sessionType: {
    type: String,
    enum: ['start', 'restart'],
    default: 'start'
  },
  sourcePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'DayPlan', default: null },
  completedItems: [{ type: String }],
  carriedForwardItems: [{ type: String }],
  focus: { type: String, default: '' },
  priorities: [{ type: String }],
  schedule: [{
    time: { type: String, default: '' },
    title: { type: String, default: '' },
    activity: { type: String, default: '' },
    description: { type: String, default: '' }
  }],
  mustDo: [{ type: String }],
  shouldDo: [{ type: String }],
  niceToHave: [{ type: String }],
  forgotten: [{ type: String }],
  deliverables: [{ type: String }],
  winCondition: [{ type: String }],
  insight: { type: String, default: '' },
  motivationalPost: {
    message: { type: String, default: '' },
    davidGogginsQuote: { type: String, default: '' },
    stoicQuote: { type: String, default: '' }
  },
  unclearItems: [{ type: String }]
}, { timestamps: true });

dayPlanSchema.pre('validate', function setLondonDate(next) {
  if (this.date) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = Object.fromEntries(formatter.formatToParts(this.date).map((part) => [part.type, part.value]));
    this.londonDate = `${parts.year}-${parts.month}-${parts.day}`;
  }
  next();
});

dayPlanSchema.index({ date: -1, createdAt: -1 });
dayPlanSchema.index({ londonDate: 1, createdAt: -1 });
dayPlanSchema.index({ status: 1, startTime: -1, createdAt: -1 });

export const DayPlan = mongoose.model('DayPlan', dayPlanSchema);
