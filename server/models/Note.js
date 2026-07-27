import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true },
  embedding: { type: [Number], select: false, default: undefined },
  embeddingModel: { type: String, default: '' },
  embeddingDimensions: { type: Number, default: null },
  embeddingContentHash: { type: String, default: '' },
  embeddingStatus: { type: String, enum: ['pending', 'ready', 'failed', 'stale'], default: 'pending' },
  embeddingUpdatedAt: { type: Date, default: null },
  embeddingErrorCode: { type: String, default: '' }
}, { timestamps: true });

export const Note = mongoose.model('Note', noteSchema);
