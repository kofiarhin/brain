import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'general' },
  status: { type: String, default: 'active' }
}, { timestamps: true });

export const Goal = mongoose.model('Goal', goalSchema);
