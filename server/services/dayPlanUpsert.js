import { DayPlan } from '../models/DayPlan.js';
import { Task } from '../models/Task.js';
import { getLondonDateKey, getLondonDayRange } from './londonDate.js';
import { normalizeTaskTitle } from './taskNormalization.js';

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

function taskTitleFromItem(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') return item.title || item.name || item.description || '';
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
        dueDate,
        dueLondonDate: londonDate,
        category: 'general',
        priority,
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

async function upsertTasksFromPlan(TaskModel, plan, range) {
  const generatedTasks = tasksFromDayPlan(plan, range.londonDate, range.start);
  if (generatedTasks.length === 0) return { created: [], updated: [], reused: [] };

  const existingTasks = await listTasksForLondonDay(TaskModel, range);
  const existingByKey = new Map(existingTasks.map((task) => [taskMatchKey(task), task]));
  const created = [];
  const updated = [];
  const reused = [];

  for (const generatedTask of generatedTasks) {
    const existing = existingByKey.get(taskMatchKey(generatedTask));

    if (!existing) {
      const createdTask = await TaskModel.create(generatedTask);
      created.push(createdTask);
      existingByKey.set(taskMatchKey(createdTask), createdTask);
      continue;
    }

    if (existing.status === 'complete' || existing.status === 'archived') {
      reused.push(existing);
      continue;
    }

    const updatedTask = await TaskModel.findByIdAndUpdate(
      existing._id,
      {
        ...generatedTask,
        status: existing.status,
        completedAt: existing.completedAt || null,
      },
      { new: true, runValidators: true }
    );
    updated.push(updatedTask);
    existingByKey.set(taskMatchKey(updatedTask), updatedTask);
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
