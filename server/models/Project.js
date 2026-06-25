import mongoose from 'mongoose';

const actionableStepSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  done: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  codexPrompt: { type: String, default: '' },
  reviewRequired: { type: Boolean, default: false },
  lastAssignedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}, { _id: true });

const progressUpdateSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  progressPercent: { type: Number, min: 0, max: 100, default: 0 },
  summary: { type: String, default: '' },
  nextActionableSteps: [{ type: String }],
  blockers: [{ type: String }]
}, { _id: true });

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, default: 'active' },
  nextActions: [{ type: String }],
  problemStatement: { type: String, default: '' },
  vision: { type: String, default: '' },
  prd: { type: String, default: '' },
  definitionOfDone: { type: String, default: '' },
  summary: { type: String, default: '' },
  progressPercent: { type: Number, min: 0, max: 100, default: 0 },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  focusToday: { type: Boolean, default: false },
  executionState: {
    type: String,
    enum: ['planning', 'in_progress', 'blocked', 'review_required', 'ready_for_production', 'completed'],
    default: 'planning'
  },
  blockers: [{ type: String }],
  agentPrompt: { type: String, default: '' },
  productionReadiness: { type: String, default: '' },
  productionChecklist: [{
    title: { type: String, default: '' },
    done: { type: Boolean, default: false }
  }],
  nextActionableSteps: [actionableStepSchema],
  progressUpdates: [progressUpdateSchema],
  lastReviewedAt: { type: Date, default: null }
}, { timestamps: true });

export const Project = mongoose.model('Project', projectSchema);
