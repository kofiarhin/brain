import { Task } from '../models/Task.js';
import { getLondonDateKey, londonDateStartUtc } from './londonDate.js';
import { normalizeTaskTitle } from './taskNormalization.js';
import { closedTaskStatuses, isActionableTask } from './taskOutcomes.js';

const incompleteStatuses = { $nin: closedTaskStatuses };

function parseTargetLondonDate(targetDate) {
  if (typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return targetDate;

  const parsed = new Date(targetDate);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('A valid targetDate is required');
    error.statusCode = 400;
    throw error;
  }

  return getLondonDateKey(parsed);
}

export function targetDateFromRequest(targetDate, now = new Date()) {
  const targetLondonDate = parseTargetLondonDate(targetDate);
  const todayLondonDate = getLondonDateKey(now);

  if (targetLondonDate < todayLondonDate) {
    const error = new Error('targetDate cannot be before today');
    error.statusCode = 400;
    throw error;
  }

  return {
    scheduledLondonDate: targetLondonDate,
    scheduledFor: londonDateStartUtc(targetLondonDate),
  };
}

export async function rescheduleTask(taskId, { targetDate, reason = '', now = new Date(), TaskModel = Task } = {}) {
  const existing = await TaskModel.findById(taskId);
  if (!existing) {
    const error = new Error('Not found');
    error.statusCode = 404;
    throw error;
  }

  const { scheduledFor, scheduledLondonDate } = targetDateFromRequest(targetDate, now);
  const historyEntry = {
    fromScheduledFor: existing.scheduledFor || null,
    fromScheduledLondonDate: existing.scheduledLondonDate || '',
    toScheduledFor: scheduledFor,
    toScheduledLondonDate: scheduledLondonDate,
    reason: reason || '',
    changedAt: now,
    actor: 'user',
    source: 'user',
  };
  const outcomeEntry = {
    fromStatus: existing.status || 'open',
    toStatus: 'rescheduled',
    fromOutcome: existing.outcome || existing.status || 'open',
    toOutcome: 'rescheduled',
    reason: reason || '',
    note: '',
    timestamp: now,
    actor: 'user',
    source: 'user',
  };

  return TaskModel.findByIdAndUpdate(
    taskId,
    {
      status: 'rescheduled',
      outcome: 'rescheduled',
      scheduledFor,
      scheduledLondonDate,
      postponedCount: (existing.postponedCount || 0) + 1,
      lastPostponedAt: now,
      postponedReason: reason || '',
      scheduleHistory: [...(existing.scheduleHistory || []), historyEntry],
      outcomeHistory: [...(existing.outcomeHistory || []), outcomeEntry],
    },
    { new: true, runValidators: true }
  );
}

export function scheduledDayKey(task) {
  return task.scheduledLondonDate
    || (task.scheduledFor ? getLondonDateKey(new Date(task.scheduledFor)) : '')
    || task.dueLondonDate
    || (task.dueDate ? getLondonDateKey(new Date(task.dueDate)) : '');
}

export function isVisibleOnLondonDate(task, londonDate) {
  if (!isActionableTask(task)) return false;
  const dayKey = scheduledDayKey(task);
  return !dayKey || dayKey <= londonDate;
}

export async function listCarryOverTasks(TaskModel, londonDate) {
  const openTasks = await TaskModel.find({ status: incompleteStatuses }).sort({ priority: 1, createdAt: 1 });
  return openTasks
    .filter((task) => {
      const dayKey = scheduledDayKey(task);
      return dayKey && dayKey <= londonDate;
    })
    .sort((left, right) => {
      const leftDay = scheduledDayKey(left);
      const rightDay = scheduledDayKey(right);
      if (leftDay !== rightDay) return leftDay < rightDay ? -1 : 1;
      return 0;
    });
}

export function equivalentOpenTask(existingTasks, generatedTask) {
  const generatedTitle = generatedTask.normalizedTitle || normalizeTaskTitle(generatedTask.title);
  const generatedDay = scheduledDayKey(generatedTask);
  const openMatches = existingTasks.filter((task) => (
    isActionableTask(task)
    && (task.normalizedTitle || normalizeTaskTitle(task.title)) === generatedTitle
  ));

  return openMatches.find((task) => scheduledDayKey(task) === generatedDay)
    || openMatches.find((task) => !scheduledDayKey(task))
    || openMatches[0]
    || null;
}
