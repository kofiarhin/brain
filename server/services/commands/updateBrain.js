import { commandModels, loadMemoryContext } from './commandContext.js';
import { assertDayPlanCountUnchanged, assertDayPlansUnchanged, snapshotDayPlans } from './commandGuards.js';
import { createBrainUpdateReport, summarizeRecord } from './commandReports.js';
import { commandResult } from './commandValidation.js';

function noteText(note) {
  return String(note?.content || '').trim();
}

function classifyNote(note) {
  const text = noteText(note);
  const lower = text.toLowerCase();
  if (!text) return { collection: 'skipped', reason: 'empty_note' };
  if (/\b(goal|outcome|target|objective)\b/.test(lower)) return { collection: 'goals' };
  if (/\b(idea|maybe|could|content|photo|video|business)\b/.test(lower)) return { collection: 'ideas' };
  if (/\b(project|client|blocker|blocked|next action|build|ship|implement)\b/.test(lower)) return { collection: 'projects' };
  if (/\b(prefer|preference|routine|constraint|remember|context|always|usually)\b/.test(lower)) return { collection: 'contextitems' };
  if (/\b(win|lesson|challenge|review|today|tomorrow)\b/.test(lower)) return { collection: 'reviews' };
  if (/\b(task|todo|follow up|write|draft|fix|update|call)\b/.test(lower)) return { collection: 'tasks' };
  return { collection: 'skipped', reason: 'unclear_destination' };
}

function firstSentence(text) {
  return text.split(/[.\n]/).map((item) => item.trim()).find(Boolean) || text.slice(0, 80);
}

async function findExistingByTitle(Model, title) {
  return Model.findOne({ title }).sort({ updatedAt: -1, createdAt: -1 });
}

async function createFromNote(models, note, classification, now) {
  const text = noteText(note);
  const title = firstSentence(text);
  if (classification.collection === 'goals') {
    const existing = await findExistingByTitle(models.GoalModel, title);
    if (existing) return { skipped: { noteId: String(note._id), reason: 'duplicate_goal', title } };
    return { created: await models.GoalModel.create({ title, description: text, status: 'active' }) };
  }
  if (classification.collection === 'ideas') {
    const existing = await findExistingByTitle(models.IdeaModel, title);
    if (existing) return { skipped: { noteId: String(note._id), reason: 'duplicate_idea', title } };
    return { created: await models.IdeaModel.create({ title, description: text, category: 'general', status: 'new' }) };
  }
  if (classification.collection === 'contextitems') {
    const existing = await models.ContextModel.findOne({ value: text }).sort({ updatedAt: -1, createdAt: -1 });
    if (existing) return { skipped: { noteId: String(note._id), reason: 'duplicate_context', title } };
    return { created: await models.ContextModel.create({ category: 'general', value: text }) };
  }
  if (classification.collection === 'tasks') {
    const existing = await findExistingByTitle(models.TaskModel, title);
    if (existing) return { linkedTask: summarizeRecord(existing), skipped: { noteId: String(note._id), reason: 'duplicate_task', title } };
    const task = await models.TaskModel.create({ title, description: text, source: 'brain-update' });
    return { created: task, linkedTask: summarizeRecord(task) };
  }
  if (classification.collection === 'reviews') {
    return { created: await models.ReviewModel.create({ date: now, wins: [], challenges: [], lessons: [text], tomorrow: [] }) };
  }
  if (classification.collection === 'projects') {
    const existing = await models.ProjectModel.findOne({ name: title }).sort({ updatedAt: -1, createdAt: -1 });
    if (existing) return { linkedProject: summarizeRecord(existing), skipped: { noteId: String(note._id), reason: 'duplicate_project', title } };
    const project = await models.ProjectModel.create({ name: title, description: text, status: 'active', executionState: 'planning' });
    return { created: project, linkedProject: summarizeRecord(project) };
  }
  return { skipped: { noteId: String(note._id), reason: classification.reason || 'unclear_destination', content: text } };
}

export async function executeUpdateBrain(options = {}) {
  const models = commandModels(options);
  const now = options.now || new Date();
  const beforeDayPlanCount = await models.DayPlanModel.countDocuments({});
  const beforeDayPlanSnapshot = await snapshotDayPlans(models.DayPlanModel);
  const created = [];
  const skippedItems = [];
  const linkedTasks = [];
  const linkedProjects = [];
  const warnings = [];
  const errors = [];

  try {
    const context = await loadMemoryContext(models);
    for (const note of context.notes) {
      try {
        const result = await createFromNote(models, note, classifyNote(note), now);
        if (result.created) created.push({ model: result.created.constructor?.modelName || 'Record', ...summarizeRecord(result.created) });
        if (result.skipped) skippedItems.push(result.skipped);
        if (result.linkedTask) linkedTasks.push(result.linkedTask);
        if (result.linkedProject) linkedProjects.push(result.linkedProject);
      } catch (error) {
        errors.push(`Note ${note?._id || 'unknown'}: ${error.message}`);
      }
    }

    await assertDayPlanCountUnchanged(models.DayPlanModel, beforeDayPlanCount);
    await assertDayPlansUnchanged(models.DayPlanModel, beforeDayPlanSnapshot);
    const status = errors.length ? (created.length ? 'partial' : 'failed') : 'success';
    if (!context.notes.length) warnings.push('No notes found to process.');

    const report = await createBrainUpdateReport(models.BrainUpdateReportModel, {
      runDate: now,
      status,
      summary: `Processed ${context.notes.length} notes; created ${created.length} records; skipped ${skippedItems.length}.`,
      recordsCreated: created,
      recordsUpdated: [],
      skippedItems,
      linkedTasks,
      linkedProjects,
      warnings,
      errors,
      nextRecommendedActions: skippedItems.length ? ['Review skipped notes and clarify their destination.'] : [],
      metadata: { notesRead: context.notes.length, dayPlanCountBefore: beforeDayPlanCount },
    });

    return {
      ...commandResult({
        command: 'update-brain',
        status,
        ids: { brainUpdateReportId: String(report._id) },
        warnings,
        errors,
        counts: {
          reportsCreated: 1,
          recordsCreated: created.length,
          recordsUpdated: 0,
          skipped: skippedItems.length,
          dayPlansCreated: 0,
        },
      }),
      report,
    };
  } catch (error) {
    errors.push(error.message);
    const report = await createBrainUpdateReport(models.BrainUpdateReportModel, {
      runDate: now,
      status: 'failed',
      summary: 'Brain update failed.',
      errors,
      metadata: { dayPlanCountBefore: beforeDayPlanCount },
    });
    return {
      ...commandResult({
        command: 'update-brain',
        status: 'failed',
        ids: { brainUpdateReportId: String(report._id) },
        errors,
        counts: { reportsCreated: 1, dayPlansCreated: 0 },
      }),
      report,
    };
  }
}
