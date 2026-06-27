import mongoose from 'mongoose';

const recordSummarySchema = new mongoose.Schema({}, { _id: false, strict: false });

const brainUpdateReportSchema = new mongoose.Schema({
  runDate: { type: Date, required: true, default: Date.now },
  status: {
    type: String,
    enum: ['success', 'partial', 'failed'],
    required: true,
  },
  summary: { type: String, default: '' },
  recordsCreated: [recordSummarySchema],
  recordsUpdated: [recordSummarySchema],
  skippedItems: [{ type: mongoose.Schema.Types.Mixed }],
  linkedTasks: [{ type: mongoose.Schema.Types.Mixed }],
  linkedProjects: [{ type: mongoose.Schema.Types.Mixed }],
  warnings: [{ type: String }],
  errors: [{ type: String }],
  nextRecommendedActions: [{ type: String }],
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

brainUpdateReportSchema.index({ runDate: -1 });
brainUpdateReportSchema.index({ status: 1 });
brainUpdateReportSchema.index({ createdAt: -1 });

export const BrainUpdateReport = mongoose.model('BrainUpdateReport', brainUpdateReportSchema);
