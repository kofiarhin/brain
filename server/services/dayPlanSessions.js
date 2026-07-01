import { Context } from '../models/Context.js';
import { DayPlan } from '../models/DayPlan.js';
import { Deliverable } from '../models/Deliverable.js';
import { Preference } from '../models/Preference.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { getLondonDateKey } from './londonDate.js';
import { normalizeTaskTitle } from './taskNormalization.js';
import { listCarryOverTasks, scheduledDayKey } from './taskScheduling.js';
import { closedTaskStatuses, taskStatus } from './taskOutcomes.js';

const eightHoursMs = 8 * 60 * 60 * 1000;
const incompleteStatuses = { $nin: closedTaskStatuses };
const priorPlanFields = ['priorities', 'mustDo', 'shouldDo', 'niceToHave', 'deliverables', 'winCondition'];

function asText(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') return item.title || item.name || item.description || item.activity || '';
  return '';
}

function uniqueTexts(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const text = asText(item).trim();
    const key = normalizeTaskTitle(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}

function excludeCompleted(items, completedKeys) {
  return uniqueTexts(items).filter((item) => !completedKeys.has(normalizeTaskTitle(item)));
}

function titleFromRecord(record) {
  return record?.title || record?.name || record?.description || record?.value || '';
}

async function findLatestActivePlan(DayPlanModel) {
  return DayPlanModel.findOne({ status: 'active' }).sort({ startTime: -1, createdAt: -1 });
}

async function listInactiveProjects(ProjectModel) {
  if (!ProjectModel) return [];
  return ProjectModel.find({ status: { $in: ['inactive', 'abandoned', 'archived'] } }).sort({ createdAt: 1 });
}

async function listOpenTasks(TaskModel, ProjectModel, londonDate) {
  const inactiveProjects = await listInactiveProjects(ProjectModel);
  const inactiveProjectIds = new Set(inactiveProjects.map((project) => String(project._id)));
  const openTasks = await TaskModel.find({ status: incompleteStatuses }).sort({ priority: 1, createdAt: 1 });
  const activeOpenTasks = openTasks.filter((task) => !task.projectId || !inactiveProjectIds.has(String(task.projectId)));
  const carryOverTasks = (await listCarryOverTasks(TaskModel, londonDate))
    .filter((task) => !task.projectId || !inactiveProjectIds.has(String(task.projectId)));
  const carryOverIds = new Set(carryOverTasks.map((task) => String(task._id)));
  const remainingTasks = activeOpenTasks.filter((task) => !carryOverIds.has(String(task._id)) && !scheduledDayKey(task));

  return {
    tasks: [...carryOverTasks, ...remainingTasks],
    carryOverTasks,
  };
}

async function listAllTasks(TaskModel) {
  return TaskModel.find().sort({ createdAt: -1 });
}

async function listOpenDeliverables(DeliverableModel) {
  return DeliverableModel.find({ status: incompleteStatuses }).sort({ createdAt: 1 });
}

async function listAllDeliverables(DeliverableModel) {
  return DeliverableModel.find().sort({ createdAt: -1 });
}

async function listContext(ContextModel) {
  return ContextModel.find().sort({ createdAt: -1 });
}

async function getActivePreference(PreferenceModel) {
  const preference = await PreferenceModel.findOne({ active: true }).sort({ updatedAt: -1 });
  return preference || PreferenceModel.create({});
}

async function listPriorPlans(DayPlanModel) {
  return DayPlanModel.find().sort({ startTime: -1, date: -1, createdAt: -1 });
}

function collectCompletedItems({ allTasks, allDeliverables, priorPlans, sourcePlan }) {
  return uniqueTexts([
    ...(sourcePlan?.completedItems || []),
    ...allTasks.filter((task) => ['complete', 'completed'].includes(taskStatus(task))).map(titleFromRecord),
    ...allDeliverables.filter((deliverable) => deliverable.status === 'complete').map(titleFromRecord),
    ...priorPlans.flatMap((plan) => plan.completedItems || []),
  ]);
}

function collectPreviousWork(sourcePlan) {
  if (!sourcePlan) return [];
  return uniqueTexts(priorPlanFields.flatMap((field) => sourcePlan[field] || []));
}

function preferenceLine(label, enabled) {
  return enabled ? label : null;
}

function buildPreferenceSummary(preference) {
  const scheduling = preference?.scheduling || {};
  const planning = preference?.planning || {};
  const personalConstraints = preference?.personalConstraints || {};
  const agentBehaviour = preference?.agentBehaviour || {};
  const lines = [
    `Planning window preference: ${scheduling.planningWindowStart || '04:00'}-${scheduling.planningWindowEnd || '21:00'}.`,
    `Daily task capacity preference: ${planning.maxDailyTasks || 5}.`,
    `Deep work preference: ${scheduling.deepWorkPreferredTime || 'morning'}; gym preference: ${scheduling.gymPreferredTime || 'afternoon'}.`,
    preferenceLine('Carry-over first preference is enabled.', planning.carryOverFirst !== false),
    preferenceLine('Minimize context switching preference is enabled.', planning.minimizeContextSwitching !== false),
    preferenceLine('Prefer high-impact execution preference is enabled.', planning.preferHighImpactExecution !== false),
    preferenceLine('Buffer time is required.', scheduling.bufferTimeRequired !== false),
    preferenceLine('Work from home constraint is active.', personalConstraints.workFromHome !== false),
    preferenceLine('Family responsibilities constraint is active.', personalConstraints.familyResponsibilities !== false),
    preferenceLine('School runs constraint is active.', personalConstraints.schoolRuns !== false),
    preferenceLine('Helping Laura with Ato constraint is active.', personalConstraints.helpingLauraWithAto !== false),
    `Agent behaviour preference: ${agentBehaviour.verbosity || 'concise'} verbosity, ${agentBehaviour.autonomy || 'medium'} autonomy.`,
  ].filter(Boolean);

  if (preference?.notes) lines.push(`Preference notes: ${preference.notes}`);
  return lines;
}

function buildSessionPayload({ now, sessionType, sourcePlan, tasks, carryOverTasks = [], allTasks, deliverables, allDeliverables, contextItems, priorPlans, preference }) {
  const startTime = new Date(now);
  const endTime = new Date(startTime.getTime() + eightHoursMs);
  const londonDate = getLondonDateKey(startTime);
  const scheduling = preference?.scheduling || {};
  const planning = preference?.planning || {};
  const output = preference?.output || {};
  const planningWindowStart = scheduling.planningWindowStart || '04:00';
  const planningWindowEnd = scheduling.planningWindowEnd || '21:00';
  const maxDailyTasks = Number(planning.maxDailyTasks) || 5;
  const completedItems = collectCompletedItems({ allTasks, allDeliverables, priorPlans, sourcePlan });
  const completedKeys = new Set(completedItems.map(normalizeTaskTitle));
  const activeTaskTitles = excludeCompleted(tasks.map(titleFromRecord), completedKeys);
  const carryOverTitles = excludeCompleted(carryOverTasks.map(titleFromRecord), completedKeys);
  const mustDo = excludeCompleted(tasks.filter((task) => task.priority === 'must' || task.priority === 'high').map(titleFromRecord), completedKeys);
  const shouldDo = excludeCompleted(tasks.filter((task) => task.priority === 'should' || task.priority === 'medium').map(titleFromRecord), completedKeys);
  const niceToHave = excludeCompleted(tasks.filter((task) => task.priority === 'nice' || task.priority === 'low').map(titleFromRecord), completedKeys);
  const deliverableTitles = excludeCompleted(deliverables.map(titleFromRecord), completedKeys);
  const previousWork = sessionType === 'restart' ? excludeCompleted(collectPreviousWork(sourcePlan), completedKeys) : [];
  const uncappedCarriedForwardItems = uniqueTexts([...carryOverTitles, ...previousWork, ...activeTaskTitles, ...deliverableTitles]);
  const carriedForwardItems = uncappedCarriedForwardItems.slice(0, maxDailyTasks);
  const selectedKeys = new Set(carriedForwardItems.map(normalizeTaskTitle));
  const selectedOnly = (items) => items.filter((item) => selectedKeys.has(normalizeTaskTitle(item)));
  const contextLines = uniqueTexts(contextItems.map((item) => [item.category, item.value].filter(Boolean).join(': '))).slice(0, 8);
  const preferenceLines = buildPreferenceSummary(preference);
  const priorities = uniqueTexts(selectedOnly([...carryOverTitles, ...mustDo, ...deliverableTitles, ...shouldDo, ...previousWork])).slice(0, 3);
  const capacityExceeded = uncappedCarriedForwardItems.length > maxDailyTasks;

  return {
    date: startTime,
    londonDate,
    startTime,
    endTime,
    status: 'active',
    sessionType,
    sourcePlanId: sourcePlan?._id || null,
    completedItems,
    carriedForwardItems,
    focus: priorities.length
      ? `Execute the active session within the ${planningWindowStart}-${planningWindowEnd} planning window around: ${priorities.join('; ')}`
      : `Review current context within the ${planningWindowStart}-${planningWindowEnd} planning window and choose the highest-impact next action.`,
    priorities,
    schedule: [
      {
        time: `${startTime.toISOString()} - ${endTime.toISOString()}`,
        title: 'Active planning session',
        activity: `Execute selected priorities inside preferred window ${planningWindowStart}-${planningWindowEnd}`,
      },
    ],
    mustDo: selectedOnly(mustDo),
    shouldDo: selectedOnly(shouldDo),
    niceToHave: selectedOnly(niceToHave),
    forgotten: uniqueTexts([...contextLines, ...preferenceLines]),
    deliverables: selectedOnly(deliverableTitles),
    winCondition: priorities.length ? [`Complete or materially advance: ${priorities[0]}`] : ['Define and complete one meaningful outcome for this session.'],
    insight: output.includeInsightOfTheDay === false ? '' : sessionType === 'restart'
      ? 'Restarted from current reality; completed work has been excluded.'
      : 'Session planned from the current runtime instead of a fixed calendar start.',
    motivationalPost: output.includeMotivationalPost === false ? { message: '', davidGogginsQuote: '', stoicQuote: '' } : {
      message: 'Win this session by finishing the work that matters now.',
      davidGogginsQuote: output.includeDavidGogginsQuote === false ? '' : 'You are in danger of living a life so comfortable and soft, that you will die without ever realizing your true potential.',
      stoicQuote: output.includeStoicQuote === false ? '' : 'First say to yourself what you would be; and then do what you have to do.',
    },
    unclearItems: priorities.length
      ? capacityExceeded ? [`Carry-over work exceeds the preference of ${maxDailyTasks} daily tasks; postpone lower-priority tasks before adding new work.`] : []
      : [`No active tasks or incomplete deliverables were found for the ${planningWindowStart}-${planningWindowEnd} planning window.`],
  };
}

async function readPlanningContext(models) {
  const londonDate = getLondonDateKey(models.now || new Date());
  const [{ tasks, carryOverTasks }, allTasks, deliverables, allDeliverables, contextItems, priorPlans, preference] = await Promise.all([
    listOpenTasks(models.TaskModel, models.ProjectModel, londonDate),
    listAllTasks(models.TaskModel),
    listOpenDeliverables(models.DeliverableModel),
    listAllDeliverables(models.DeliverableModel),
    listContext(models.ContextModel),
    listPriorPlans(models.DayPlanModel),
    getActivePreference(models.PreferenceModel),
  ]);

  return { tasks, carryOverTasks, allTasks, deliverables, allDeliverables, contextItems, priorPlans, preference };
}

async function closeCurrentActivePlan(DayPlanModel, status) {
  const activePlan = await findLatestActivePlan(DayPlanModel);
  if (!activePlan) return null;

  return DayPlanModel.findByIdAndUpdate(
    activePlan._id,
    { status },
    { new: true, runValidators: true }
  );
}

export async function startDaySession(options = {}) {
  const models = {
    DayPlanModel: options.DayPlanModel || DayPlan,
    TaskModel: options.TaskModel || Task,
    ProjectModel: options.ProjectModel || Project,
    DeliverableModel: options.DeliverableModel || Deliverable,
    ContextModel: options.ContextModel || Context,
    PreferenceModel: options.PreferenceModel || Preference,
  };
  const now = options.now || new Date();

  await closeCurrentActivePlan(models.DayPlanModel, 'archived');
  const context = await readPlanningContext({ ...models, now });
  const payload = buildSessionPayload({ now, sessionType: 'start', sourcePlan: null, ...context });
  const dayPlan = await models.DayPlanModel.create(payload);

  return { dayPlan };
}

export async function restartDaySession(options = {}) {
  const models = {
    DayPlanModel: options.DayPlanModel || DayPlan,
    TaskModel: options.TaskModel || Task,
    ProjectModel: options.ProjectModel || Project,
    DeliverableModel: options.DeliverableModel || Deliverable,
    ContextModel: options.ContextModel || Context,
    PreferenceModel: options.PreferenceModel || Preference,
  };
  const now = options.now || new Date();
  const sourcePlan = await closeCurrentActivePlan(models.DayPlanModel, 'restarted');

  if (!sourcePlan) {
    const error = new Error('No active day plan found to restart');
    error.statusCode = 404;
    throw error;
  }

  const context = await readPlanningContext({ ...models, now });
  const payload = buildSessionPayload({ now, sessionType: 'restart', sourcePlan, ...context });
  const dayPlan = await models.DayPlanModel.create(payload);

  return { dayPlan, sourcePlan };
}

export function sessionWindowFor(now = new Date()) {
  const startTime = new Date(now);
  return {
    startTime,
    endTime: new Date(startTime.getTime() + eightHoursMs),
  };
}
