import mongoose from 'mongoose';
import { getLondonDateKey } from '../services/londonDate.js';
import { normalizeTaskTitle } from '../services/taskNormalization.js';

export const taskCategories = ['projects', 'family', 'personal', 'admin', 'general'];

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  normalizedTitle: { type: String, trim: true },
  description: { type: String, default: '' },
  category: { type: String, enum: taskCategories, default: 'general' },
  agentReady: { type: Boolean, default: false },
  priority: { type: String, enum: ['must', 'should', 'nice', 'low', 'medium', 'high'], default: 'should' },
  status: { type: String, enum: ['open', 'complete', 'archived'], default: 'open' },
  completedAt: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  dueLondonDate: { type: String, default: '' },
  source: { type: String, default: 'manual' }
}, { timestamps: true });

function setTaskMatchingFields(target) {
  if (target.title) target.normalizedTitle = normalizeTaskTitle(target.title);
  if (target.dueDate) target.dueLondonDate = getLondonDateKey(new Date(target.dueDate));
}

taskSchema.pre('validate', function setMatchingFields(next) {
  setTaskMatchingFields(this);
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

export const Task = mongoose.model('Task', taskSchema);
