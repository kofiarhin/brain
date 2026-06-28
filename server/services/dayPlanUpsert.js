import { DayPlan } from '../models/DayPlan.js';
import { Task } from '../models/Task.js';
import { getLondonDateKey, getLondonDayRange } from './londonDate.js';
import { normalizeTaskTitle } from './taskNormalization.js';
import { equivalentOpenTask } from './taskScheduling.js';

const planTaskSources = [
  ['mustDo', 'must'],
  ['shouldDo', 'should'],
  ['niceToHave', 'nice'],
  ['deliverables', 'high'],
];

function cleanDayPlanPayload(plan, londonDate, dueDate) {
  const {
    _id,
    id,
    createdAt,
    updatedAt,
    londonDate: ignoredLondonDate,
    ...payload
  } = plan;

  return {
    ...payload,
    date: dueDate,
    londonDate,
  };
}

function taskTextFromItem(item, field) {
  if (!item || typeof item !== 'object') return '';
  if (field === 'deliverables') return item.expectedDeliverable || item.deliverable || item.title || item.name || item.description || '';
  return item.description || item.summary || item.activity || '';
}

function taskTitleFromItem(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') return item.title || item.name || item.description || '';
  return '';
}

function normalizeGeneratedPriority(priority) {
  if (priority === 'high') return 'must';
  if (priority === 'medium') return 'should';
  if (priority === 'low') return 'nice';
  return priority;
}

function generatedDescription(title, item, field) {
  const explicitDescription = taskTextFromItem(item, field).trim();
  if (explicitDescription && explicitDescription !== title) return explicitDescription;
  const section = {
    mustDo: 'Must Do',
    shouldDo: 'Should Do',
    niceToHave: 'Nice To Have',
    deliverables: 'Suggested Deliverables',
  }[field] || 'day plan';
  return `Complete this ${section} item from today's plan: ${title}`;
}

function generatedExpectedDeliverable(title, item, field) {
  if (item && typeof item === 'object') {
    const explicit = (item.expectedDeliverable || item.deliverable || item.output || '').trim();
    if (explicit) return explicit;
  }
  return field === 'deliverables' ? title : '';
}

function generatedAcceptanceCriteria(title, item, field) {
  if (item && typeof item === 'object') {
    const criteria = item.acceptanceCriteria || item.criteria || item.definitionOfDone;
    if (Array.isArray(criteria)) return criteria.filter(Boolean).join('\n');
    if (typeof criteria === 'string' && criteria.trim()) return criteria.trim();
  }
  const criteria = [
    `${title} is completed.`,
    'Result has been reviewed or checked.',
  ];
  if (field === 'deliverables') criteria.splice(1, 0, 'Expected deliverable exists.');
  return criteria.join('\n');
}

function generatedCodexPrompt(title, item) {
  if (item && typeof item === 'object' && typeof item.codexPrompt === 'string') return item.codexPrompt.trim();
  return '';
}

export function tasksFromDayPlan(plan, londonDate, dueDate) {
  const seen = new Set();
  const tasks = [];

  for (const [field, priority] of planTaskSources) {
    for (const item of plan[field] || []) {
      const title = taskTitleFromItem(item).trim();
      const normalizedTitle = normalizeTaskTitle(title);
      const key = `${normalizedTitle}|${londonDate}`;
      if (!normalizedTitle || seen.has(key)) continue;
      seen.add(key);

      tasks.push({
        title,
        normalizedTitle,
        description: generatedDescription(title, item, field),
        deliverableRequired: field === 'deliverables' || Boolean(item && typeof item === 'object' && (item.expectedDeliverable || item.deliverable || item.output)),
        expectedDeliverable: generatedExpectedDeliverable(title, item, field),
        deliverableSummary: '',
        deliverableLocation: '',
        acceptanceCriteria: generatedAcceptanceCriteria(title, item, field),
        notes: '',
        codexPrompt: generatedCodexPrompt(title, item),
        dueDate,
        dueLondonDate: londonDate,
        scheduledFor: dueDate,
        scheduledLondonDate: londonDate,
        category: item && typeof item === 'object' ? item.category || 'general' : 'general',
        priority: normalizeGeneratedPriority(priority),
        source: 'day-plan',
      });
    }
  }

  return tasks;
}

function taskDayKey(task) {
  return task.dueLondonDate || (task.dueDate ? getLondonDateKey(new Date(task.dueDate)) : '');
}

function taskMatchKey(task) {
  return `${task.normalizedTitle || normalizeTaskTitle(task.title)}|${taskDayKey(task)}`;
}

async function findTodaysDayPlan(DayPlanModel, range) {
  return DayPlanModel.findOne({
    date: { $gte: range.start, $lt: range.end },
  }).sort({ createdAt: 1 });
}

async function listTasksForLondonDay(TaskModel, range) {
  return TaskModel.find({
    $or: [
      { dueLondonDate: range.londonDate },
      { dueDate: { $gte: range.start, $lt: range.end } },
    ],
  }).sort({ createdAt: 1 });
}

async function listAllTasks(TaskModel) {
  return TaskModel.find({}).sort({ createdAt: 1 });
}

function mergedGeneratedTask(existing, generatedTask) {
  return {
    ...generatedTask,
    description: existing.description || generatedTask.description,
    deliverableRequired: existing.deliverableRequired || generatedTask.deliverableRequired,
    expectedDeliverable: existing.expectedDeliverable || generatedTask.expectedDeliverable,
    deliverableSummary: existing.deliverableSummary || generatedTask.deliverableSummary,
    deliverableLocation: existing.deliverableLocation || generatedTask.deliverableLocation,
    deliverableTitle: existing.deliverableTitle || generatedTask.deliverableTitle || '',
    deliverableDescription: existing.deliverableDescription || generatedTask.deliverableDescription || '',
    deliverableUrl: existing.deliverableUrl || generatedTask.deliverableUrl || '',
    acceptanceCriteria: existing.acceptanceCriteria || generatedTask.acceptanceCriteria,
    notes: existing.notes || generatedTask.notes,
    projectId: existing.projectId || generatedTask.projectId || null,
    projectActionId: existing.projectActionId || generatedTask.projectActionId || null,
    codexPrompt: existing.codexPrompt || generatedTask.codexPrompt,
    reviewRequired: existing.reviewRequired || generatedTask.reviewRequired || false,
    reviewStatus: existing.reviewStatus || generatedTask.reviewStatus || 'pending',
    reviewNotes: existing.reviewNotes || generatedTask.reviewNotes || '',
    agentReady: existing.agentReady || generatedTask.agentReady || false,
    status: existing.status,
    completedAt: existing.completedAt || null,
    postponedCount: existing.postponedCount || 0,
    lastPostponedAt: existing.lastPostponedAt || null,
    postponedReason: existing.postponedReason || '',
    scheduleHistory: existing.scheduleHistory || [],
  };
}

async function upsertTasksFromPlan(TaskModel, plan, range) {
  const generatedTasks = tasksFromDayPlan(plan, range.londonDate, range.start);
  if (generatedTasks.length === 0) return { created: [], updated: [], reused: [] };

  const existingTasks = await listTasksForLondonDay(TaskModel, range);
  const allTasks = await listAllTasks(TaskModel);
  const existingByKey = new Map(existingTasks.map((task) => [taskMatchKey(task), task]));
  const created = [];
  const updated = [];
  const reused = [];

  for (const generatedTask of generatedTasks) {
    const existing = existingByKey.get(taskMatchKey(generatedTask)) || equivalentOpenTask(allTasks, generatedTask);

    if (!existing) {
      const createdTask = await TaskModel.create(generatedTask);
      created.push(createdTask);
      existingByKey.set(taskMatchKey(createdTask), createdTask);
      allTasks.push(createdTask);
      continue;
    }

    if (existing.status === 'complete' || existing.status === 'archived') {
      reused.push(existing);
      continue;
    }

    const updatedTask = await TaskModel.findByIdAndUpdate(
      existing._id,
      mergedGeneratedTask(existing, generatedTask),
      { new: true, runValidators: true }
    );
    updated.push(updatedTask);
    existingByKey.set(taskMatchKey(updatedTask), updatedTask);
    const allIndex = allTasks.findIndex((task) => String(task._id) === String(updatedTask._id));
    if (allIndex >= 0) allTasks[allIndex] = updatedTask;
  }

  return { created, updated, reused };
}

export async function upsertTodaysDayPlan(plan, options = {}) {
  const {
    now = new Date(),
    DayPlanModel = DayPlan,
    TaskModel = Task,
  } = options;

  const range = getLondonDayRange(now);
  const payload = cleanDayPlanPayload(plan, range.londonDate, range.start);
  const existingPlan = await findTodaysDayPlan(DayPlanModel, range);
  const dayPlan = existingPlan
    ? await DayPlanModel.findByIdAndUpdate(existingPlan._id, payload, { new: true, runValidators: true })
    : await DayPlanModel.create(payload);

  const tasks = await upsertTasksFromPlan(TaskModel, dayPlan, range);

  return {
    dayPlan,
    tasks,
    londonDate: range.londonDate,
    range,
    created: !existingPlan,
  };
}
