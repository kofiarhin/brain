import { closedTaskStatuses, isClosedTask } from '../taskOutcomes.js';

export const inactiveProjectStatuses = ['inactive', 'abandoned', 'archived'];
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
