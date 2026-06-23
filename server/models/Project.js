import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, default: 'active' },
  nextActions: [{ type: String }],
  blockers: [{ type: String }]
}, { timestamps: true });

export const Project = mongoose.model('Project', projectSchema);
