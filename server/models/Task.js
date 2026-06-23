import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'general' },
  priority: { type: String, enum: ['must', 'should', 'nice', 'low', 'medium', 'high'], default: 'should' },
  status: { type: String, enum: ['open', 'complete', 'archived'], default: 'open' },
  completedAt: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  source: { type: String, default: 'manual' }
}, { timestamps: true });

export const Task = mongoose.model('Task', taskSchema);
