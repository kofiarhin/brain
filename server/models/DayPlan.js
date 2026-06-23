import mongoose from 'mongoose';

const dayPlanSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  focus: { type: String, default: '' },
  priorities: [{ type: String }],
  schedule: [{ time: String, activity: String }],
  mustDo: [{ type: String }],
  shouldDo: [{ type: String }],
  niceToHave: [{ type: String }],
  forgotten: [{ type: String }],
  deliverables: [{ type: String }],
  winCondition: [{ type: String }],
  insight: { type: String, default: '' },
  motivationalPost: { type: String, default: '' },
  unclearItems: [{ type: String }]
}, { timestamps: true });

dayPlanSchema.index({ date: -1 });

export const DayPlan = mongoose.model('DayPlan', dayPlanSchema);
