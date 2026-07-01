import { closedTaskStatuses, isClosedTask } from '../taskOutcomes.js';

export const inactiveProjectStatuses = ['inactive', 'completed', 'abandoned', 'archived'];
export const inactiveProjectExecutionStates = ['blocked', 'completed', 'ready_for_production'];

export function isEligibleProject(project) {
  if (!project) return false;
  return !inactiveProjectStatuses.includes(project.status)
    && !inactiveProjectExecutionStates.includes(project.executionState);
}

export function isOpenTask(task) {
  return task && !isClosedTask(task);
}

export function closedTaskQuery() {
  return { $in: closedTaskStatuses };
}

export async function assertSingleActiveDayPlan(DayPlanModel) {
  const count = await DayPlanModel.countDocuments({ status: 'active' });
  if (count !== 1) {
    const error = new Error(`Expected exactly one active DayPlan, found ${count}`);
    error.statusCode = 500;
    throw error;
  }
}

export async function assertDayPlanCountUnchanged(DayPlanModel, beforeCount) {
  const afterCount = await DayPlanModel.countDocuments({});
  if (afterCount !== beforeCount) {
    const error = new Error(`DayPlan count changed during update brain: before=${beforeCount}, after=${afterCount}`);
    error.statusCode = 500;
    throw error;
  }
  return afterCount;
}

function dayPlanSignature(plan) {
  return JSON.stringify({
    id: String(plan?._id || ''),
    status: plan?.status || '',
    sessionType: plan?.sessionType || '',
    sourcePlanId: plan?.sourcePlanId ? String(plan.sourcePlanId) : null,
    londonDate: plan?.londonDate || '',
    startTime: plan?.startTime ? new Date(plan.startTime).toISOString() : null,
    endTime: plan?.endTime ? new Date(plan.endTime).toISOString() : null,
    updatedAt: plan?.updatedAt ? new Date(plan.updatedAt).toISOString() : null,
  });
}

export async function snapshotDayPlans(DayPlanModel) {
  const plans = await DayPlanModel.find({}).sort({ createdAt: 1 });
  return plans.map(dayPlanSignature).sort();
}

export async function assertDayPlansUnchanged(DayPlanModel, beforeSnapshot) {
  const afterSnapshot = await snapshotDayPlans(DayPlanModel);
  if (JSON.stringify(afterSnapshot) !== JSON.stringify(beforeSnapshot)) {
    const error = new Error('DayPlans changed during update brain');
    error.statusCode = 500;
    throw error;
  }
  return afterSnapshot;
}
