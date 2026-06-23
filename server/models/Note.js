import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true }
}, { timestamps: true });

export const Note = mongoose.model('Note', noteSchema);
