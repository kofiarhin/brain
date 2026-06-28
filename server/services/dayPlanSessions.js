import { Context } from '../models/Context.js';
import { DayPlan } from '../models/DayPlan.js';
import { Deliverable } from '../models/Deliverable.js';
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

function buildSessionPayload({ now, sessionType, sourcePlan, tasks, carryOverTasks = [], allTasks, deliverables, allDeliverables, contextItems, priorPlans }) {
  const startTime = new Date(now);
  const endTime = new Date(startTime.getTime() + eightHoursMs);
  const londonDate = getLondonDateKey(startTime);
  const completedItems = collectCompletedItems({ allTasks, allDeliverables, priorPlans, sourcePlan });
  const completedKeys = new Set(completedItems.map(normalizeTaskTitle));
  const activeTaskTitles = excludeCompleted(tasks.map(titleFromRecord), completedKeys);
  const carryOverTitles = excludeCompleted(carryOverTasks.map(titleFromRecord), completedKeys);
  const mustDo = excludeCompleted(tasks.filter((task) => task.priority === 'must' || task.priority === 'high').map(titleFromRecord), completedKeys);
  const shouldDo = excludeCompleted(tasks.filter((task) => task.priority === 'should' || task.priority === 'medium').map(titleFromRecord), completedKeys);
  const niceToHave = excludeCompleted(tasks.filter((task) => task.priority === 'nice' || task.priority === 'low').map(titleFromRecord), completedKeys);
  const deliverableTitles = excludeCompleted(deliverables.map(titleFromRecord), completedKeys);
  const previousWork = sessionType === 'restart' ? excludeCompleted(collectPreviousWork(sourcePlan), completedKeys) : [];
  const carriedForwardItems = uniqueTexts([...carryOverTitles, ...previousWork, ...activeTaskTitles, ...deliverableTitles]);
  const contextLines = uniqueTexts(contextItems.map((item) => [item.category, item.value].filter(Boolean).join(': '))).slice(0, 8);
  const priorities = uniqueTexts([...carryOverTitles, ...mustDo, ...deliverableTitles, ...shouldDo, ...previousWork]).slice(0, 3);
  const capacityExceeded = carriedForwardItems.length > 8;

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
    focus: priorities.length ? `Execute the next 8 hours around: ${priorities.join('; ')}` : 'Review current context and choose the highest-impact next action.',
    priorities,
    schedule: [
      { time: `${startTime.toISOString()} - ${endTime.toISOString()}`, title: 'Active planning session', activity: 'Execute selected priorities' },
    ],
    mustDo,
    shouldDo,
    niceToHave,
    forgotten: contextLines,
    deliverables: deliverableTitles,
    winCondition: priorities.length ? [`Complete or materially advance: ${priorities[0]}`] : ['Define and complete one meaningful outcome for this session.'],
    insight: sessionType === 'restart'
      ? 'Restarted from current reality; completed work has been excluded.'
      : 'Session planned from the current runtime instead of a fixed calendar start.',
    motivationalPost: {
      message: 'Win this session by finishing the work that matters now.',
      davidGogginsQuote: 'You are in danger of living a life so comfortable and soft, that you will die without ever realizing your true potential.',
      stoicQuote: 'First say to yourself what you would be; and then do what you have to do.',
    },
    unclearItems: priorities.length
      ? capacityExceeded ? ['Carry-over work exceeds the 8-hour planning capacity; postpone lower-priority tasks before adding new work.'] : []
      : ['No active tasks or incomplete deliverables were found.'],
  };
}

async function readPlanningContext(models) {
  const londonDate = getLondonDateKey(models.now || new Date());
  const [{ tasks, carryOverTasks }, allTasks, deliverables, allDeliverables, contextItems, priorPlans] = await Promise.all([
    listOpenTasks(models.TaskModel, models.ProjectModel, londonDate),
    listAllTasks(models.TaskModel),
    listOpenDeliverables(models.DeliverableModel),
    listAllDeliverables(models.DeliverableModel),
    listContext(models.ContextModel),
    listPriorPlans(models.DayPlanModel),
  ]);

  return { tasks, carryOverTasks, allTasks, deliverables, allDeliverables, contextItems, priorPlans };
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
