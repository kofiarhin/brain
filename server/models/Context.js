import mongoose from 'mongoose';

const contextSchema = new mongoose.Schema({
  category: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true }
}, { timestamps: true });

export const Context = mongoose.model('Context', contextSchema);
