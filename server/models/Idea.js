import mongoose from 'mongoose';

const ideaSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'general' },
  status: { type: String, default: 'new' }
}, { timestamps: true });

export const Idea = mongoose.model('Idea', ideaSchema);
