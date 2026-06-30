import mongoose from 'mongoose';

const preferenceSchema = new mongoose.Schema({
  title: { type: String, default: 'Default Preferences', trim: true },
  active: { type: Boolean, default: true },
  scheduling: {
    planningWindowStart: { type: String, default: '04:00', trim: true },
    planningWindowEnd: { type: String, default: '21:00', trim: true },
    deepWorkPreferredTime: { type: String, default: 'morning', trim: true },
    gymPreferredTime: { type: String, default: 'afternoon', trim: true },
    meetingAvoidBefore: { type: String, default: '10:00', trim: true },
    bufferTimeRequired: { type: Boolean, default: true },
  },
  planning: {
    maxDailyTasks: { type: Number, default: 5, min: 1 },
    minimizeContextSwitching: { type: Boolean, default: true },
    preferHighImpactExecution: { type: Boolean, default: true },
    carryOverFirst: { type: Boolean, default: true },
  },
  personalConstraints: {
    workFromHome: { type: Boolean, default: true },
    familyResponsibilities: { type: Boolean, default: true },
    schoolRuns: { type: Boolean, default: true },
    helpingLauraWithAto: { type: Boolean, default: true },
  },
  output: {
    concise: { type: Boolean, default: true },
    includeMotivationalPost: { type: Boolean, default: true },
    includeDavidGogginsQuote: { type: Boolean, default: true },
    includeStoicQuote: { type: Boolean, default: true },
    includeInsightOfTheDay: { type: Boolean, default: true },
  },
  agentBehaviour: {
    verbosity: { type: String, enum: ['concise', 'balanced', 'detailed'], default: 'concise' },
    autonomy: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  },
  notes: { type: String, default: '', trim: true },
}, { timestamps: true });

preferenceSchema.index({ active: 1, updatedAt: -1 });

export const Preference = mongoose.model('Preference', preferenceSchema);
