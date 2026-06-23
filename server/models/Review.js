import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  wins: [{ type: String }],
  challenges: [{ type: String }],
  lessons: [{ type: String }],
  tomorrow: [{ type: String }]
}, { timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);
