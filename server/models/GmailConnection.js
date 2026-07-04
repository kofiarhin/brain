import mongoose from 'mongoose';

const gmailConnectionSchema = new mongoose.Schema({
  provider: { type: String, enum: ['gmail'], default: 'gmail', unique: true },
  emailAddress: { type: String, trim: true, default: '' },
  refreshToken: { type: String, required: true },
  scope: { type: String, default: '' },
  tokenType: { type: String, default: '' },
  expiryDate: { type: Date, default: null },
  connectedAt: { type: Date, default: Date.now },
  lastSyncedAt: { type: Date, default: null },
  status: { type: String, enum: ['connected', 'revoked', 'error'], default: 'connected' },
  lastError: { type: String, default: '' }
}, { timestamps: true });

gmailConnectionSchema.index({ provider: 1 }, { unique: true });

export const GmailConnection = mongoose.model('GmailConnection', gmailConnectionSchema);
