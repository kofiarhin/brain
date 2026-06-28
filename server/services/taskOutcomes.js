import { Project } from '../models/Project.js';
import { Task, dismissalReasons } from '../models/Task.js';

export const closedTaskStatuses = ['complete', 'completed', 'dismissed', 'archived', 'converted'];

export function taskStatus(task) {
  return String(task?.outcome || task?.status || 'open').toLowerCase();
}

export function isClosedTask(task) {
  return closedTaskStatuses.includes(taskStatus(task));
}

export function isActionableTask(task) {
  return !isClosedTask(task);
}

function transitionEntry(existing, toStatus, { reason = '', note = '', now = new Date(), actor = 'user', source = 'user' } = {}) {
  const fromStatus = existing?.status || 'open';
  const fromOutcome = existing?.outcome || fromStatus;
  return {
    fromStatus,
    toStatus,
    fromOutcome,
    toOutcome: toStatus,
    reason: reason || '',
    note: note || '',
    timestamp: now,
    actor,
    source,
  };
}

async function findTaskOrThrow(taskId, TaskModel) {
  const existing = await TaskModel.findById(taskId);
  if (!existing) {
    const error = new Error('Not found');
    error.statusCode = 404;
    throw error;
  }
  return existing;
}

export async function completeTask(taskId, { now = new Date(), TaskModel = Task } = {}) {
  const existing = await findTaskOrThrow(taskId, TaskModel);
  const history = [...(existing.outcomeHistory || []), transitionEntry(existing, 'complete', { now })];
  return TaskModel.findByIdAndUpdate(taskId, {
    status: 'complete',
    outcome: 'complete',
    completedAt: now,
    outcomeHistory: history,
  }, { new: true, runValidators: true });
}

export async function reopenTask(taskId, { now = new Date(), TaskModel = Task } = {}) {
  const existing = await findTaskOrThrow(taskId, TaskModel);
  const history = [...(existing.outcomeHistory || []), transitionEntry(existing, 'open', { now })];
  return TaskModel.findByIdAndUpdate(taskId, {
    status: 'open',
    outcome: 'open',
    completedAt: null,
    dismissedAt: null,
    dismissedReason: '',
    dismissedNote: '',
    archivedAt: null,
    convertedAt: null,
    replacementTaskId: null,
    outcomeHistory: history,
  }, { new: true, runValidators: true });
}

export async function archiveTask(taskId, { reason = '', note = '', now = new Date(), TaskModel = Task } = {}) {
  const existing = await findTaskOrThrow(taskId, TaskModel);
  const history = [...(existing.outcomeHistory || []), transitionEntry(existing, 'archived', { reason, note, now })];
  return TaskModel.findByIdAndUpdate(taskId, {
    status: 'archived',
    outcome: 'archived',
    archivedAt: now,
    outcomeHistory: history,
  }, { new: true, runValidators: true });
}

export async function dismissTask(taskId, {
  reason,
  note = '',
  markProjectInactive = false,
  now = new Date(),
  TaskModel = Task,
  ProjectModel = Project,
} = {}) {
  if (!dismissalReasons.includes(reason)) {
    const error = new Error('A valid dismissal reason is required');
    error.statusCode = 400;
    throw error;
  }

  const existing = await findTaskOrThrow(taskId, TaskModel);
  const history = [...(existing.outcomeHistory || []), transitionEntry(existing, 'dismissed', { reason, note, now })];
  const task = await TaskModel.findByIdAndUpdate(taskId, {
    status: 'dismissed',
    outcome: 'dismissed',
    dismissedAt: now,
    dismissedReason: reason,
    dismissedNote: note || '',
    outcomeHistory: history,
  }, { new: true, runValidators: true });

  if (reason === 'project_abandoned' && markProjectInactive && existing.projectId) {
    await ProjectModel.findByIdAndUpdate(existing.projectId, {
      status: 'inactive',
      executionState: 'blocked',
      focusToday: false,
      lastReviewedAt: now,
    }, { new: true, runValidators: true });
  }

  return task;
}

export async function convertTask(taskId, {
  replacementTaskId = null,
  replacementTask = null,
  reason = 'replaced_by_another_task',
  note = '',
  now = new Date(),
  TaskModel = Task,
} = {}) {
  const existing = await findTaskOrThrow(taskId, TaskModel);
  let replacementId = replacementTaskId;

  if (!replacementId && replacementTask) {
    const created = await TaskModel.create({
      ...replacementTask,
      projectId: replacementTask.projectId ?? existing.projectId ?? null,
      source: replacementTask.source || 'conversion',
    });
    replacementId = created._id;
  }

  if (!replacementId) {
    const error = new Error('replacementTaskId or replacementTask is required');
    error.statusCode = 400;
    throw error;
  }

  const history = [...(existing.outcomeHistory || []), transitionEntry(existing, 'converted', { reason, note, now })];
  return TaskModel.findByIdAndUpdate(taskId, {
    status: 'converted',
    outcome: 'converted',
    convertedAt: now,
    replacementTaskId: replacementId,
    outcomeHistory: history,
  }, { new: true, runValidators: true });
}
