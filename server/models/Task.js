import mongoose from 'mongoose';
import { getLondonDateKey } from '../services/londonDate.js';
import { categorizeTaskTitle } from '../services/taskCategorization.js';
import { normalizeTaskTitle } from '../services/taskNormalization.js';

export const taskCategories = ['projects', 'family', 'personal', 'admin', 'general'];
export const taskStatuses = ['open', 'closed', 'complete', 'completed', 'rescheduled', 'dismissed', 'archived', 'converted'];
export const dismissalReasons = [
  'task_no_longer_needed',
  'project_abandoned',
  'duplicate',
  'generated_incorrectly',
  'circumstances_changed',
  'external_blocker',
  'replaced_by_another_task',
  'other',
];

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  normalizedTitle: { type: String, trim: true },
  description: { type: String, default: '' },
  deliverableRequired: { type: Boolean, default: false },
  expectedDeliverable: { type: String, default: '' },
  deliverableSummary: { type: String, default: '' },
  deliverableLocation: { type: String, default: '' },
  deliverableTitle: { type: String, default: '' },
  deliverableDescription: { type: String, default: '' },
  deliverableUrl: { type: String, default: '' },
  acceptanceCriteria: { type: String, default: '' },
  notes: { type: String, default: '' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  projectActionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  codexPrompt: { type: String, default: '' },
  reviewRequired: { type: Boolean, default: false },
  reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'partial'], default: 'pending' },
  reviewNotes: { type: String, default: '' },
  category: { type: String, enum: taskCategories, default: 'general' },
  agentReady: { type: Boolean, default: false },
  priority: { type: String, enum: ['must', 'should', 'nice', 'low', 'medium', 'high'], default: 'should' },
  status: { type: String, enum: taskStatuses, default: 'open' },
  outcome: { type: String, enum: taskStatuses, default: 'open' },
  completedAt: { type: Date, default: null },
  dismissedAt: { type: Date, default: null },
  dismissedReason: { type: String, enum: [...dismissalReasons, ''], default: '' },
  dismissedNote: { type: String, default: '' },
  archivedAt: { type: Date, default: null },
  convertedAt: { type: Date, default: null },
  replacementTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  outcomeHistory: [{
    fromStatus: { type: String, default: '' },
    toStatus: { type: String, default: '' },
    fromOutcome: { type: String, default: '' },
    toOutcome: { type: String, default: '' },
    reason: { type: String, default: '' },
    note: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    actor: { type: String, default: 'user' },
    source: { type: String, default: 'user' },
  }],
  dueDate: { type: Date, default: null },
  dueLondonDate: { type: String, default: '' },
  scheduledFor: { type: Date, default: null },
  scheduledLondonDate: { type: String, default: '' },
  postponedCount: { type: Number, default: 0, min: 0 },
  lastPostponedAt: { type: Date, default: null },
  postponedReason: { type: String, default: '' },
  scheduleHistory: [{
    fromScheduledFor: { type: Date, default: null },
    fromScheduledLondonDate: { type: String, default: '' },
    toScheduledFor: { type: Date, default: null },
    toScheduledLondonDate: { type: String, default: '' },
    reason: { type: String, default: '' },
    changedAt: { type: Date, default: Date.now },
  }],
  source: { type: String, default: 'manual' }
}, { timestamps: true });

function setTaskMatchingFields(target) {
  if (target.title) target.normalizedTitle = normalizeTaskTitle(target.title);
  if (target.dueDate) target.dueLondonDate = getLondonDateKey(new Date(target.dueDate));
  if (target.scheduledFor) target.scheduledLondonDate = getLondonDateKey(new Date(target.scheduledFor));
  if (target.status && !target.outcome) target.outcome = target.status;
  if (target.outcome && !target.status) target.status = target.outcome;
}

taskSchema.pre('validate', function setMatchingFields(next) {
  setTaskMatchingFields(this);
  if (this.isNew) this.category = categorizeTaskTitle(this.title);
  next();
});

taskSchema.pre('findOneAndUpdate', function setUpdatedMatchingFields(next) {
  const update = this.getUpdate() || {};
  const target = update.$set || update;
  setTaskMatchingFields(target);
  if (update.$set) this.setUpdate({ ...update, $set: target });
  else this.setUpdate(target);
  next();
});

taskSchema.index({ normalizedTitle: 1, dueLondonDate: 1 });
taskSchema.index({ scheduledLondonDate: 1, status: 1 });

export const Task = mongoose.model('Task', taskSchema);
