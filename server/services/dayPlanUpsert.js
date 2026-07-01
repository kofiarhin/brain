import { DayPlan } from '../models/DayPlan.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { getLondonDateKey, getLondonDayRange } from './londonDate.js';
import { normalizeTaskTitle } from './taskNormalization.js';
import { equivalentOpenTask } from './taskScheduling.js';
import { closedTaskStatuses, isClosedTask } from './taskOutcomes.js';

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

function taskTextFromItem(item, field) {
  if (!item || typeof item !== 'object') return '';
  if (field === 'deliverables') return item.expectedDeliverable || item.deliverable || item.title || item.name || item.description || '';
  return item.description || item.summary || item.activity || '';
}

function taskTitleFromItem(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') return item.title || item.name || item.description || '';
  return '';
}

function normalizeGeneratedPriority(priority) {
  if (priority === 'high') return 'must';
  if (priority === 'medium') return 'should';
  if (priority === 'low') return 'nice';
  return priority;
}

function generatedDescription(title, item, field) {
  const explicitDescription = taskTextFromItem(item, field).trim();
  if (explicitDescription && explicitDescription !== title) return explicitDescription;
  const section = {
    mustDo: 'Must Do',
    shouldDo: 'Should Do',
    niceToHave: 'Nice To Have',
    deliverables: 'Suggested Deliverables',
  }[field] || 'day plan';
  return `Complete this ${section} item from today's plan: ${title}`;
}

function generatedExpectedDeliverable(title, item, field) {
  if (item && typeof item === 'object') {
    const explicit = (item.expectedDeliverable || item.deliverable || item.output || '').trim();
    if (explicit) return explicit;
  }
  return field === 'deliverables' ? title : '';
}

function generatedAcceptanceCriteria(title, item, field) {
  if (item && typeof item === 'object') {
    const criteria = item.acceptanceCriteria || item.criteria || item.definitionOfDone;
    if (Array.isArray(criteria)) return criteria.filter(Boolean).join('\n');
    if (typeof criteria === 'string' && criteria.trim()) return criteria.trim();
  }
  const criteria = [
    `${title} is completed.`,
    'Result has been reviewed or checked.',
  ];
  if (field === 'deliverables') criteria.splice(1, 0, 'Expected deliverable exists.');
  return criteria.join('\n');
}

function compactLines(values) {
  return values
    .flat(Infinity)
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());
}

function markdownBullets(values, fallback) {
  const lines = compactLines(values);
  return (lines.length ? lines : [fallback]).map((line) => `- ${line}`).join('\n');
}

function isExplicitlyAgentExecutable(item) {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.agentExecutable === 'boolean') return item.agentExecutable;
  if (typeof item.agentReady === 'boolean') return item.agentReady;
  return null;
}

function hasMeaningfulAgentOutput(title, item, field) {
  const explicit = isExplicitlyAgentExecutable(item);
  if (explicit !== null) return explicit;
  if (item && typeof item === 'object' && typeof item.codexPrompt === 'string' && item.codexPrompt.trim()) return true;
  if (field === 'deliverables') return true;
  if (item && typeof item === 'object' && (item.expectedDeliverable || item.deliverable || item.output)) return true;

  const text = compactLines([
    title,
    item && typeof item === 'object'
      ? [
          item.description,
          item.summary,
          item.activity,
          item.category,
          item.expectedDeliverable,
          item.deliverable,
          item.output,
        ]
      : [],
  ]).join(' ').toLowerCase();

  const nonAgentPatterns = [
    /\b(call|phone|ring)\b/,
    /\b(gym|workout|exercise|run|walk)\b/,
    /\b(school|pickup|pick up|dropoff|drop off|nursery)\b/,
    /\b(appointment|meeting|meet|visit)\b/,
    /\b(buy|collect|deliver|drive|clean|cook|shop)\b/,
  ];
  if (nonAgentPatterns.some((pattern) => pattern.test(text))) return false;

  const agentPatterns = [
    /\b(implement|build|code|ship|develop|create|add|update|fix|debug|refactor|test|document|docs|write|draft|edit|research|analyse|analyze|review|summari[sz]e|plan|design|brief|proposal|content|copy|article|post|script|outline|audit|process|data|report|strategy|spec|prd|ui|ux|frontend|backend|api|bug)\b/,
  ];
  return agentPatterns.some((pattern) => pattern.test(text));
}

function generatedCodexPrompt(title, item, field, generatedTask) {
  if (item && typeof item === 'object' && typeof item.codexPrompt === 'string') return item.codexPrompt.trim();
  if (!hasMeaningfulAgentOutput(title, item, field)) return '';

  const projectContext = compactLines([
    item && typeof item === 'object'
      ? [
          item.projectName ? `Project: ${item.projectName}` : '',
          item.projectId ? `Project ID: ${item.projectId}` : '',
          item.projectActionId ? `Project action ID: ${item.projectActionId}` : '',
          item.projectSummary,
          item.problemStatement,
          item.prd,
          item.definitionOfDone,
          Array.isArray(item.blockers) ? item.blockers.map((blocker) => `Blocker: ${blocker}`) : [],
        ]
      : [],
  ]);
  const constraints = compactLines([
    item && typeof item === 'object'
      ? [
          item.constraints,
          item.notes,
          item.deadline ? `Deadline: ${item.deadline}` : '',
        ]
      : [],
    generatedTask.scheduledLondonDate ? `This task is scheduled for ${generatedTask.scheduledLondonDate}.` : '',
  ]);
  const expectedOutput = generatedTask.expectedDeliverable
    || (generatedTask.deliverableRequired ? title : 'A meaningful completed output or first draft for the task.');

  return [
    'Implement the following task.',
    '',
    'Objective:',
    title,
    '',
    'Context:',
    generatedTask.description || `Complete this task from today's day plan: ${title}`,
    '',
    'Expected Output:',
    expectedOutput,
    '',
    'Constraints:',
    markdownBullets(constraints, 'Keep the work scoped to this task.'),
    '',
    'Existing Project Context:',
    markdownBullets(projectContext, 'No linked project context was provided.'),
    '',
    'Acceptance Criteria:',
    markdownBullets(generatedTask.acceptanceCriteria.split('\n'), `${title} is completed.`),
    '',
    'Instructions:',
    '- Inspect the repository before making changes.',
    '- Preserve existing behavior unless explicitly asked to change it.',
    '- Do not change unrelated functionality.',
    '- Keep changes minimal and focused.',
    '- Add or update tests where appropriate.',
    '- Run the relevant test/build commands.',
  ].join('\n');
}

function isGeneratedCodexPrompt(prompt) {
  if (typeof prompt !== 'string') return false;
  return prompt.trim().startsWith('Implement the following task.\n\nObjective:\n');
}

function mergedCodexPrompt(existing, generatedTask) {
  const existingPrompt = existing.codexPrompt || '';
  if (!existingPrompt.trim()) return generatedTask.codexPrompt;
  if (isGeneratedCodexPrompt(existingPrompt)) return generatedTask.codexPrompt;
  return existingPrompt;
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

      const generatedTask = {
        title,
        normalizedTitle,
        description: generatedDescription(title, item, field),
        deliverableRequired: field === 'deliverables' || Boolean(item && typeof item === 'object' && (item.expectedDeliverable || item.deliverable || item.output)),
        expectedDeliverable: generatedExpectedDeliverable(title, item, field),
        deliverableSummary: '',
        deliverableLocation: '',
        acceptanceCriteria: generatedAcceptanceCriteria(title, item, field),
        notes: '',
        projectId: item && typeof item === 'object' ? item.projectId || null : null,
        projectActionId: item && typeof item === 'object' ? item.projectActionId || null : null,
        dueDate,
        dueLondonDate: londonDate,
        scheduledFor: dueDate,
        scheduledLondonDate: londonDate,
        category: item && typeof item === 'object' ? item.category || 'general' : 'general',
        priority: normalizeGeneratedPriority(priority),
        source: 'day-plan',
      };
      const agentReady = hasMeaningfulAgentOutput(title, item, field);
      tasks.push({
        ...generatedTask,
        codexPrompt: generatedCodexPrompt(title, item, field, generatedTask),
        agentReady,
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

async function listAllTasks(TaskModel) {
  return TaskModel.find({}).sort({ createdAt: 1 });
}

async function listInactiveProjects(ProjectModel) {
  if (!ProjectModel) return [];
  return ProjectModel.find({ status: { $in: ['inactive', 'abandoned', 'archived'] } }).sort({ createdAt: 1 });
}

function mergedGeneratedTask(existing, generatedTask) {
  return {
    ...generatedTask,
    description: existing.description || generatedTask.description,
    deliverableRequired: existing.deliverableRequired || generatedTask.deliverableRequired,
    expectedDeliverable: existing.expectedDeliverable || generatedTask.expectedDeliverable,
    deliverableSummary: existing.deliverableSummary || generatedTask.deliverableSummary,
    deliverableLocation: existing.deliverableLocation || generatedTask.deliverableLocation,
    deliverableTitle: existing.deliverableTitle || generatedTask.deliverableTitle || '',
    deliverableDescription: existing.deliverableDescription || generatedTask.deliverableDescription || '',
    deliverableUrl: existing.deliverableUrl || generatedTask.deliverableUrl || '',
    acceptanceCriteria: existing.acceptanceCriteria || generatedTask.acceptanceCriteria,
    notes: existing.notes || generatedTask.notes,
    projectId: existing.projectId || generatedTask.projectId || null,
    projectActionId: existing.projectActionId || generatedTask.projectActionId || null,
    codexPrompt: mergedCodexPrompt(existing, generatedTask),
    reviewRequired: existing.reviewRequired || generatedTask.reviewRequired || false,
    reviewStatus: existing.reviewStatus || generatedTask.reviewStatus || 'pending',
    reviewNotes: existing.reviewNotes || generatedTask.reviewNotes || '',
    agentReady: existing.agentReady || generatedTask.agentReady || false,
    status: existing.status,
    outcome: existing.outcome || existing.status || 'open',
    completedAt: existing.completedAt || null,
    dismissedAt: existing.dismissedAt || null,
    dismissedReason: existing.dismissedReason || '',
    dismissedNote: existing.dismissedNote || '',
    archivedAt: existing.archivedAt || null,
    convertedAt: existing.convertedAt || null,
    replacementTaskId: existing.replacementTaskId || null,
    outcomeHistory: existing.outcomeHistory || [],
    postponedCount: existing.postponedCount || 0,
    lastPostponedAt: existing.lastPostponedAt || null,
    postponedReason: existing.postponedReason || '',
    scheduleHistory: existing.scheduleHistory || [],
  };
}

function equivalentClosedTask(allTasks, generatedTask) {
  const generatedTitle = generatedTask.normalizedTitle || normalizeTaskTitle(generatedTask.title);
  const avoidStatuses = new Set(closedTaskStatuses);
  return allTasks.find((task) => (
    avoidStatuses.has(String(task.outcome || task.status || '').toLowerCase())
    && (task.normalizedTitle || normalizeTaskTitle(task.title)) === generatedTitle
  )) || null;
}

function hasInactiveProject(generatedTask, inactiveProjectIds) {
  return generatedTask.projectId && inactiveProjectIds.has(String(generatedTask.projectId));
}

export async function upsertTasksFromPlan(TaskModel, ProjectModel, plan, range) {
  const generatedTasks = tasksFromDayPlan(plan, range.londonDate, range.start);
  if (generatedTasks.length === 0) return { created: [], updated: [], reused: [] };

  const existingTasks = await listTasksForLondonDay(TaskModel, range);
  const allTasks = await listAllTasks(TaskModel);
  const inactiveProjects = await listInactiveProjects(ProjectModel);
  const inactiveProjectIds = new Set(inactiveProjects.map((project) => String(project._id)));
  const existingByKey = new Map(existingTasks.map((task) => [taskMatchKey(task), task]));
  const created = [];
  const updated = [];
  const reused = [];

  for (const generatedTask of generatedTasks) {
    if (hasInactiveProject(generatedTask, inactiveProjectIds)) continue;

    const existing = existingByKey.get(taskMatchKey(generatedTask))
      || equivalentOpenTask(allTasks, generatedTask)
      || equivalentClosedTask(allTasks, generatedTask);

    if (!existing) {
      const createdTask = await TaskModel.create(generatedTask);
      created.push(createdTask);
      existingByKey.set(taskMatchKey(createdTask), createdTask);
      allTasks.push(createdTask);
      continue;
    }

    if (isClosedTask(existing)) {
      reused.push(existing);
      continue;
    }

    const updatedTask = await TaskModel.findByIdAndUpdate(
      existing._id,
      mergedGeneratedTask(existing, generatedTask),
      { new: true, runValidators: true }
    );
    updated.push(updatedTask);
    existingByKey.set(taskMatchKey(updatedTask), updatedTask);
    const allIndex = allTasks.findIndex((task) => String(task._id) === String(updatedTask._id));
    if (allIndex >= 0) allTasks[allIndex] = updatedTask;
  }

  return { created, updated, reused };
}

export async function upsertTodaysDayPlan(plan, options = {}) {
  const {
    now = new Date(),
    DayPlanModel = DayPlan,
    TaskModel = Task,
    ProjectModel = options.ProjectModel || (options.TaskModel ? null : Project),
  } = options;

  const range = getLondonDayRange(now);
  const payload = cleanDayPlanPayload(plan, range.londonDate, range.start);
  const existingPlan = await findTodaysDayPlan(DayPlanModel, range);
  const dayPlan = existingPlan
    ? await DayPlanModel.findByIdAndUpdate(existingPlan._id, payload, { new: true, runValidators: true })
    : await DayPlanModel.create(payload);

  const tasks = await upsertTasksFromPlan(TaskModel, ProjectModel, dayPlan, range);

  return {
    dayPlan,
    tasks,
    londonDate: range.londonDate,
    range,
    created: !existingPlan,
  };
}
