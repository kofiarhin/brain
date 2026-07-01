import { getLondonDayRange } from '../londonDate.js';
import { startDaySession } from '../dayPlanSessions.js';
import { upsertTasksFromPlan } from '../dayPlanUpsert.js';
import { commandModels } from './commandContext.js';
import { assertSingleActiveDayPlan } from './commandGuards.js';
import { commandResult, validateDayPlan } from './commandValidation.js';

export async function executeGoodMorning(options = {}) {
  const models = commandModels(options);
  const now = options.now || new Date();
  const { dayPlan } = await startDaySession({
    now,
    DayPlanModel: models.DayPlanModel,
    TaskModel: models.TaskModel,
    ProjectModel: models.ProjectModel,
    GoalModel: models.GoalModel,
    DeliverableModel: models.DeliverableModel,
    ContextModel: models.ContextModel,
    PreferenceModel: models.PreferenceModel,
    BrainUpdateReportModel: models.BrainUpdateReportModel,
  });
  validateDayPlan(dayPlan, 'good-morning');
  await assertSingleActiveDayPlan(models.DayPlanModel);

  const range = getLondonDayRange(now);
  const tasks = await upsertTasksFromPlan(models.TaskModel, models.ProjectModel, dayPlan, range);

  return {
    ...commandResult({
      command: 'good-morning',
      ids: { dayPlanId: String(dayPlan._id) },
      warnings: dayPlan.unclearItems || [],
      counts: {
        dayPlansCreated: 1,
        tasksCreated: tasks.created.length,
        tasksUpdated: tasks.updated.length,
        tasksReused: tasks.reused.length,
      },
    }),
    dayPlan,
    tasks,
  };
}
