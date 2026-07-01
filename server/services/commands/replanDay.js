import { getLondonDayRange } from '../londonDate.js';
import { restartDaySession } from '../dayPlanSessions.js';
import { upsertTasksFromPlan } from '../dayPlanUpsert.js';
import { commandModels } from './commandContext.js';
import { assertSingleActiveDayPlan } from './commandGuards.js';
import { commandResult, validateDayPlan } from './commandValidation.js';

export async function executeReplanDay(options = {}) {
  const models = commandModels(options);
  const now = options.now || new Date();
  const { dayPlan, sourcePlan } = await restartDaySession({
    now,
    DayPlanModel: models.DayPlanModel,
    TaskModel: models.TaskModel,
    ProjectModel: models.ProjectModel,
    DeliverableModel: models.DeliverableModel,
    ContextModel: models.ContextModel,
    PreferenceModel: models.PreferenceModel,
  });
  validateDayPlan(dayPlan, 'replan-day');
  await assertSingleActiveDayPlan(models.DayPlanModel);

  const range = getLondonDayRange(now);
  const tasks = await upsertTasksFromPlan(models.TaskModel, models.ProjectModel, dayPlan, range);

  return {
    ...commandResult({
      command: 'replan-day',
      ids: { dayPlanId: String(dayPlan._id), sourcePlanId: String(sourcePlan._id) },
      warnings: dayPlan.unclearItems || [],
      counts: {
        dayPlansCreated: 1,
        dayPlansRestarted: 1,
        tasksCreated: tasks.created.length,
        tasksUpdated: tasks.updated.length,
        tasksReused: tasks.reused.length,
      },
    }),
    dayPlan,
    sourcePlan,
    tasks,
  };
}
