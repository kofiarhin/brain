import mongoose from 'mongoose';

const generatedPostSourceSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  url: { type: String, default: '' },
  publisher: { type: String, default: '' },
  publishedAt: { type: Date, default: null },
  notes: { type: String, default: '' },
}, { _id: false });

const researchAgentSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  sourceFocus: { type: String, default: '' },
  summary: { type: String, default: '' },
  sources: [generatedPostSourceSchema],
}, { _id: false });

const generatedPostSchema = new mongoose.Schema({
  runDate: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ['success', 'partial', 'failed'], required: true },
  selectedTopic: { type: String, default: '' },
  topicRationale: { type: String, default: '' },
  researchSummary: { type: String, default: '' },
  researchAgents: [researchAgentSchema],
  linkedInPost: { type: String, default: '' },
  xPost: { type: String, default: '' },
  inspirationalMessage: { type: String, default: '' },
  reviewNotes: [{ type: String }],
  iterationCount: { type: Number, min: 0, max: 3, default: 0 },
  warnings: [{ type: String }],
  errors: [{ type: String }],
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

generatedPostSchema.index({ runDate: -1 });
generatedPostSchema.index({ status: 1 });
generatedPostSchema.index({ createdAt: -1 });

export const GeneratedPost = mongoose.model('GeneratedPost', generatedPostSchema);
