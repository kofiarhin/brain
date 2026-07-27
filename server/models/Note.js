import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true },
  embedding: { type: [Number], select: false, default: undefined },
  embeddingModel: { type: String, default: '' },
  embeddingDimensions: { type: Number, default: null },
  embeddingContentHash: { type: String, default: '' },
  embeddingStatus: {
    type: String,
    // `processing` marks a job that has been picked up by a worker; it is
    // distinct from `pending` (queued, not started) so a restart can identify
    // jobs that were interrupted mid-flight.
    enum: ['pending', 'processing', 'ready', 'failed', 'stale'],
    default: 'pending',
  },
  embeddingUpdatedAt: { type: Date, default: null },
  embeddingQueuedAt: { type: Date, default: null },
  embeddingAttempts: { type: Number, default: 0 },
  embeddingErrorCode: { type: String, default: '' },
}, { timestamps: true });

// Supports the backfill/recovery query for notes that are not `ready`.
noteSchema.index({ embeddingStatus: 1, updatedAt: -1 });

export const Note = mongoose.model('Note', noteSchema);
