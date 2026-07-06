import { Context } from '../models/Context.js';
import { Preference } from '../models/Preference.js';
import { Goal } from '../models/Goal.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { DayPlan } from '../models/DayPlan.js';
import { Note } from '../models/Note.js';
import { Idea } from '../models/Idea.js';
import { Review } from '../models/Review.js';
import { Deliverable } from '../models/Deliverable.js';
import { GeneratedPost } from '../models/GeneratedPost.js';
import { BrainUpdateReport } from '../models/BrainUpdateReport.js';
import { ChatMessage } from '../models/ChatMessage.js';

function keywordsFrom(message = '') {
  return [...new Set(message.toLowerCase().match(/[a-z0-9]{3,}/g) || [])].slice(0, 8);
}
function regexQuery(fields, message) {
  const words = keywordsFrom(message);
  if (!words.length) return {};
  return { $or: words.flatMap((word) => fields.map((field) => ({ [field]: new RegExp(word, 'i') }))) };
}
async function safeFind(promise, fallback = []) {
  try { return await promise; } catch { return fallback; }
}

export async function buildBrainContext({ message, conversationId } = {}) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [stableContext, preferences, activeGoals, activeProjects, openTasks, activeDayPlan, fallbackDayPlan, relevantNotes, relevantIdeas, reviews, deliverables, generatedPosts, brainUpdateReports, recentMessagesRaw] = await Promise.all([
    safeFind(Context.find({}).sort({ updatedAt: -1 }).limit(50)),
    safeFind(Preference.find({ active: true }).sort({ updatedAt: -1 }).limit(5)),
    safeFind(Goal.find({ status: 'active' }).sort({ updatedAt: -1 }).limit(20)),
    safeFind(Project.find({ status: { $nin: ['completed'] }, executionState: { $nin: ['completed'] } }).sort({ focusToday: -1, priority: -1, updatedAt: -1 }).limit(12)),
    safeFind(Task.find({ status: { $in: ['open'] } }).sort({ priority: 1, scheduledFor: 1, dueDate: 1, updatedAt: -1 }).limit(25)),
    safeFind(DayPlan.findOne({ status: 'active' }).sort({ startTime: -1, createdAt: -1 }), null),
    safeFind(DayPlan.findOne({}).sort({ date: -1, createdAt: -1 }), null),
    safeFind(Note.find(regexQuery(['content'], message)).sort({ updatedAt: -1 }).limit(10)),
    safeFind(Idea.find(regexQuery(['title', 'description'], message)).sort({ updatedAt: -1 }).limit(10)),
    safeFind(Review.find({}).sort({ date: -1, createdAt: -1 }).limit(3)),
    safeFind(Deliverable.find({}).sort({ date: -1, updatedAt: -1 }).limit(10)),
    safeFind(GeneratedPost.find({}).sort({ runDate: -1, createdAt: -1 }).limit(3)),
    safeFind(BrainUpdateReport.find({}).sort({ runDate: -1, createdAt: -1 }).limit(5)),
    conversationId ? safeFind(ChatMessage.find({ conversationId }).sort({ createdAt: -1 }).limit(8)) : [],
  ]);
  const recentMessages = [...recentMessagesRaw].reverse();
  return {
    profile: {}, stableContext, preferences, activeGoals, activeProjects, openTasks,
    todayOrLatestDayPlan: activeDayPlan || fallbackDayPlan, relevantNotes, relevantIdeas,
    reviews, deliverables, generatedPosts, brainUpdateReports, recentMessages,
    contextUsed: {
      context: stableContext.length, preferences: preferences.length, goals: activeGoals.length,
      projects: activeProjects.length, tasks: openTasks.length, dayPlans: activeDayPlan || fallbackDayPlan ? 1 : 0,
      notes: relevantNotes.length, ideas: relevantIdeas.length, reviews: reviews.length,
      deliverables: deliverables.length, generatedPosts: generatedPosts.length, brainUpdateReports: brainUpdateReports.length,
      recentMessages: recentMessages.length,
    },
  };
}
