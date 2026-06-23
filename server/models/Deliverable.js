import mongoose from 'mongoose';

const deliverableSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['open', 'complete', 'archived'], default: 'open' },
  date: { type: Date, default: null }
}, { timestamps: true });

export const Deliverable = mongoose.model('Deliverable', deliverableSchema);
