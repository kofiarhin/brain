import { BrainUpdateReport } from '../../models/BrainUpdateReport.js';
import { Context } from '../../models/Context.js';
import { DayPlan } from '../../models/DayPlan.js';
import { Deliverable } from '../../models/Deliverable.js';
import { GeneratedPost } from '../../models/GeneratedPost.js';
import { Goal } from '../../models/Goal.js';
import { Idea } from '../../models/Idea.js';
import { Note } from '../../models/Note.js';
import { Preference } from '../../models/Preference.js';
import { Project } from '../../models/Project.js';
import { Review } from '../../models/Review.js';
import { Task } from '../../models/Task.js';

export function commandModels(overrides = {}) {
  return {
    NoteModel: overrides.NoteModel || Note,
    GoalModel: overrides.GoalModel || Goal,
    GeneratedPostModel: overrides.GeneratedPostModel || GeneratedPost,
    ProjectModel: overrides.ProjectModel || Project,
    IdeaModel: overrides.IdeaModel || Idea,
    ContextModel: overrides.ContextModel || Context,
    PreferenceModel: overrides.PreferenceModel || Preference,
    ReviewModel: overrides.ReviewModel || Review,
    TaskModel: overrides.TaskModel || Task,
    DayPlanModel: overrides.DayPlanModel || DayPlan,
    DeliverableModel: overrides.DeliverableModel || Deliverable,
    BrainUpdateReportModel: overrides.BrainUpdateReportModel || BrainUpdateReport,
  };
}

async function listAll(Model, sort = { createdAt: -1 }) {
  return Model.find({}).sort(sort);
}

export async function loadMemoryContext(models) {
  const [
    notes,
    goals,
    projects,
    ideas,
    contextItems,
    preferences,
    reviews,
    tasks,
    dayPlans,
    deliverables,
    brainUpdateReports,
  ] = await Promise.all([
    listAll(models.NoteModel),
    listAll(models.GoalModel),
    listAll(models.ProjectModel),
    listAll(models.IdeaModel),
    listAll(models.ContextModel),
    listAll(models.PreferenceModel),
    listAll(models.ReviewModel),
    listAll(models.TaskModel),
    listAll(models.DayPlanModel),
    listAll(models.DeliverableModel),
    listAll(models.BrainUpdateReportModel),
  ]);

  return { notes, goals, projects, ideas, contextItems, preferences, reviews, tasks, dayPlans, deliverables, brainUpdateReports };
}
