import { getLondonDayRange } from '../londonDate.js';
import { restartDaySession, startDaySession } from '../dayPlanSessions.js';
import { upsertTasksFromPlan } from '../dayPlanUpsert.js';
import { commandModels } from './commandContext.js';
import { assertSingleActiveDayPlan } from './commandGuards.js';
import { commandResult, validateDayPlan } from './commandValidation.js';
import { executeUpdateBrain as defaultExecuteUpdateBrain } from './updateBrain.js';

const countKeys = [
  'reportsCreated',
  'recordsCreated',
  'recordsUpdated',
  'skipped',
  'dayPlansCreated',
  'dayPlansRestarted',
  'tasksCreated',
  'tasksUpdated',
  'tasksReused',
];

function completeCounts(counts = {}) {
  return Object.fromEntries(countKeys.map((key) => [key, counts[key] || 0]));
}

function mergeCounts(...countsList) {
  return countsList.reduce((merged, counts) => {
    const complete = completeCounts(counts);
    for (const key of countKeys) merged[key] += complete[key];
    return merged;
  }, completeCounts());
}

function taskCounts(tasks) {
  return {
    tasksCreated: tasks?.created?.length || 0,
    tasksUpdated: tasks?.updated?.length || 0,
    tasksReused: tasks?.reused?.length || 0,
  };
}

async function findActiveDayPlan(DayPlanModel) {
  return DayPlanModel.findOne({ status: 'active' }).sort({ startTime: -1, createdAt: -1 });
}

function sessionModels(models, now) {
  return {
    now,
    DayPlanModel: models.DayPlanModel,
    TaskModel: models.TaskModel,
    ProjectModel: models.ProjectModel,
    GoalModel: models.GoalModel,
    DeliverableModel: models.DeliverableModel,
    ContextModel: models.ContextModel,
    PreferenceModel: models.PreferenceModel,
    BrainUpdateReportModel: models.BrainUpdateReportModel,
  };
}

export async function executeRefreshBrain(options = {}) {
  const models = commandModels(options);
  const now = options.now || new Date();
  const executeUpdateBrain = options.executeUpdateBrain || defaultExecuteUpdateBrain;
  const warnings = [];
  const errors = [];
  let updateResult;

  try {
    updateResult = await executeUpdateBrain({ ...options, ...models, now });
    warnings.push(...(updateResult.warnings || []));
    errors.push(...(updateResult.errors || []));

    if (updateResult.status === 'failed') {
      return {
        ...commandResult({
          command: 'refresh-brain',
          status: 'failed',
          ids: {
            brainUpdateReportId: updateResult.ids?.brainUpdateReportId,
          },
          warnings,
          errors,
          counts: mergeCounts(updateResult.counts),
        }),
        report: updateResult.report,
        dayPlan: null,
        tasks: { created: [], updated: [], reused: [] },
      };
    }

    const activePlan = await findActiveDayPlan(models.DayPlanModel);
    const session = activePlan
      ? await restartDaySession(sessionModels(models, now))
      : await startDaySession(sessionModels(models, now));
    const { dayPlan, sourcePlan = null } = session;

    validateDayPlan(dayPlan, 'refresh-brain');
    await assertSingleActiveDayPlan(models.DayPlanModel);

    const range = getLondonDayRange(now);
    const tasks = await upsertTasksFromPlan(models.TaskModel, models.ProjectModel, dayPlan, range);
    const dayPlanWarnings = dayPlan.unclearItems || [];
    warnings.push(...dayPlanWarnings);

    const ids = {
      brainUpdateReportId: updateResult.ids?.brainUpdateReportId,
      dayPlanId: String(dayPlan._id),
    };
    if (sourcePlan) ids.sourcePlanId = String(sourcePlan._id);

    return {
      ...commandResult({
        command: 'refresh-brain',
        status: updateResult.status === 'partial' ? 'partial' : 'success',
        ids,
        warnings,
        errors,
        counts: mergeCounts(updateResult.counts, {
          dayPlansCreated: 1,
          dayPlansRestarted: sourcePlan ? 1 : 0,
          ...taskCounts(tasks),
        }),
      }),
      report: updateResult.report,
      dayPlan,
      ...(sourcePlan ? { sourcePlan } : {}),
      tasks,
    };
  } catch (error) {
    errors.push(error.message);
    return {
      ...commandResult({
        command: 'refresh-brain',
        status: 'failed',
        ids: {
          brainUpdateReportId: updateResult?.ids?.brainUpdateReportId,
        },
        warnings,
        errors,
        counts: mergeCounts(updateResult?.counts),
      }),
      report: updateResult?.report,
      dayPlan: null,
      tasks: { created: [], updated: [], reused: [] },
    };
  }
}
