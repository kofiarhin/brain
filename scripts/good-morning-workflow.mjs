import 'dotenv/config';
import mongoose from 'mongoose';

import { connectDB } from '../server/config/db.js';
import { Context } from '../server/models/Context.js';
import { DayPlan } from '../server/models/DayPlan.js';
import { Deliverable } from '../server/models/Deliverable.js';
import { Goal } from '../server/models/Goal.js';
import { Idea } from '../server/models/Idea.js';
import { Note } from '../server/models/Note.js';
import { Preference } from '../server/models/Preference.js';
import { Project } from '../server/models/Project.js';
import { Review } from '../server/models/Review.js';
import { Task } from '../server/models/Task.js';
import { getLondonDateKey, londonDateStartUtc } from '../server/services/londonDate.js';
import { normalizeTaskTitle } from '../server/services/taskNormalization.js';

const today = process.env.BRAIN_TODAY || '2026-07-01';
const now = new Date(`${today}T08:00:00+01:00`);
const closedStatuses = ['complete', 'completed', 'dismissed', 'archived', 'converted'];
const inactiveProjectStatuses = ['inactive', 'abandoned', 'archived'];
const blockedExecutionStates = ['blocked', 'completed', 'ready_for_production'];

function docText(value) {
  if (!value) return '';
  return String(value).trim();
}

function unique(items) {
  const seen = new Set();
  const result = [];
  for (const item of items.map(docText).filter(Boolean)) {
    const key = normalizeTaskTitle(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function priorityRank(task) {
  const priority = task.priority || 'should';
  if (priority === 'must' || priority === 'high') return 0;
  if (priority === 'should' || priority === 'medium') return 1;
  if (priority === 'nice' || priority === 'low') return 2;
  return 3;
}

function isOpenTask(task) {
  return !closedStatuses.includes(task.status || task.outcome || 'open');
}

function isCarryOver(task, londonDate) {
  const scheduled = task.scheduledLondonDate || '';
  const due = task.dueLondonDate || '';
  return (scheduled && scheduled <= londonDate) || (due && due <= londonDate);
}

function taskLine(task) {
  const project = task.projectId?.name ? ` (${task.projectId.name})` : '';
  return `${task.title}${project}`;
}

function buildCodexPrompt({ title, project, step }) {
  const context = [
    project?.summary && `Project summary: ${project.summary}`,
    project?.problemStatement && `Problem statement: ${project.problemStatement}`,
    project?.prd && `PRD/context: ${project.prd}`,
    project?.definitionOfDone && `Definition of done: ${project.definitionOfDone}`,
    project?.blockers?.length ? `Known blockers: ${project.blockers.join('; ')}` : '',
    step?.codexPrompt && `Existing project action prompt: ${step.codexPrompt}`,
  ].filter(Boolean).join('\n');

  return [
    `You are working in the Brain OS project workspace.`,
    `Task: ${title}`,
    context,
    `Deliver a meaningful first draft or implementation for this task.`,
    `Preserve existing project context, avoid unrelated refactors, and finish by listing what changed plus any verification performed.`,
  ].filter(Boolean).join('\n\n');
}

async function readContext(londonDate) {
  const [
    notes,
    goals,
    projects,
    ideas,
    contextItems,
    preference,
    reviews,
    tasks,
    deliverables,
    dayplans,
  ] = await Promise.all([
    Note.find().sort({ createdAt: -1 }),
    Goal.find().sort({ createdAt: -1 }),
    Project.find().sort({ focusToday: -1, priority: -1, updatedAt: -1 }),
    Idea.find().sort({ createdAt: -1 }),
    Context.find().sort({ createdAt: -1 }),
    Preference.findOne({ active: true }).sort({ updatedAt: -1 }),
    Review.find().sort({ date: -1, createdAt: -1 }),
    Task.find().populate('projectId').sort({ scheduledFor: 1, dueDate: 1, priority: 1, createdAt: 1 }),
    Deliverable.find().sort({ createdAt: -1 }),
    DayPlan.find().sort({ date: -1, createdAt: -1 }),
  ]);

  return {
    notes,
    goals,
    projects,
    ideas,
    contextItems,
    preference: preference || await Preference.create({}),
    reviews,
    tasks,
    deliverables,
    dayplans,
    londonDate,
  };
}

function selectExistingTasks({ tasks, projects, londonDate, maxDailyTasks }) {
  const inactiveProjectIds = new Set(
    projects
      .filter((project) => inactiveProjectStatuses.includes(project.status))
      .map((project) => String(project._id))
  );

  const openTasks = tasks.filter((task) => (
    isOpenTask(task)
    && (!task.projectId || !inactiveProjectIds.has(String(task.projectId._id || task.projectId)))
  ));
  const carryOver = openTasks.filter((task) => isCarryOver(task, londonDate));
  const unscheduled = openTasks.filter((task) => !carryOver.some((item) => String(item._id) === String(task._id)));
  const sorted = [...carryOver, ...unscheduled].sort((a, b) => priorityRank(a) - priorityRank(b));

  return {
    openTasks,
    carryOver,
    selected: sorted.slice(0, maxDailyTasks),
  };
}

async function createOrUpdateProjectTasks({ projects, openTasks, selected, londonDate, maxDailyTasks }) {
  const selectedIds = new Set(selected.map((task) => String(task._id)));
  const openByKey = new Map();
  for (const task of openTasks) {
    const keys = [task.normalizedTitle, normalizeTaskTitle(task.title)].filter(Boolean);
    for (const key of keys) openByKey.set(key, task);
    if (task.projectId && task.projectActionId) {
      openByKey.set(`${task.projectId._id || task.projectId}:${task.projectActionId}`, task);
    }
  }

  const eligibleProjects = projects.filter((project) => (
    !inactiveProjectStatuses.includes(project.status)
    && !blockedExecutionStates.includes(project.executionState)
  )).sort((a, b) => Number(b.focusToday) - Number(a.focusToday));

  const changedTasks = [];
  const createdTasks = [];

  for (const project of eligibleProjects) {
    const steps = (project.nextActionableSteps || []).filter((step) => !step.done && !step.completedAt && step.title);
    for (const step of steps) {
      if (selected.length >= maxDailyTasks) break;
      const title = `${project.name}: ${step.title}`;
      const actionKey = `${project._id}:${step._id}`;
      const titleKey = normalizeTaskTitle(title);
      const existing = openByKey.get(actionKey) || openByKey.get(titleKey) || openByKey.get(normalizeTaskTitle(step.title));
      const priority = step.priority === 'high' || project.priority === 'high' ? 'must' : step.priority === 'low' ? 'nice' : 'should';
      const prompt = buildCodexPrompt({ title, project, step });

      if (existing) {
        const update = {};
        if (!existing.scheduledLondonDate) update.scheduledFor = londonDateStartUtc(londonDate);
        if (!existing.projectId) update.projectId = project._id;
        if (!existing.projectActionId) update.projectActionId = step._id;
        if (!existing.codexPrompt || existing.codexPrompt.length < 40) update.codexPrompt = prompt;
        if (!existing.description) update.description = `Project task for ${project.name}: ${step.title}`;
        if (!existing.acceptanceCriteria && project.definitionOfDone) update.acceptanceCriteria = project.definitionOfDone;
        if (Object.keys(update).length) {
          const updated = await Task.findByIdAndUpdate(existing._id, { $set: update }, { new: true, runValidators: true }).populate('projectId');
          changedTasks.push(updated);
          if (!selectedIds.has(String(updated._id))) selected.push(updated);
        } else if (!selectedIds.has(String(existing._id))) {
          selected.push(existing);
        }
        selectedIds.add(String(existing._id));
        continue;
      }

      const created = await Task.create({
        title,
        description: `Project task for ${project.name}: ${step.title}`,
        projectId: project._id,
        projectActionId: step._id,
        priority,
        status: 'open',
        outcome: 'open',
        scheduledFor: londonDateStartUtc(londonDate),
        deliverableRequired: true,
        expectedDeliverable: `Completed work or a review-ready draft for: ${step.title}`,
        acceptanceCriteria: project.definitionOfDone || `The task has a concrete, reviewable output for ${project.name}.`,
        notes: [project.summary, project.blockers?.length ? `Blockers: ${project.blockers.join('; ')}` : ''].filter(Boolean).join('\n'),
        codexPrompt: prompt,
        agentReady: true,
        reviewRequired: true,
        source: 'day_planning',
      });
      const populated = await Task.findById(created._id).populate('projectId');
      createdTasks.push(populated);
      selected.push(populated);
      selectedIds.add(String(populated._id));

      await Project.updateOne(
        { _id: project._id, 'nextActionableSteps._id': step._id },
        { $set: { 'nextActionableSteps.$.lastAssignedAt': now } }
      );
    }
  }

  return { selected: selected.slice(0, maxDailyTasks), createdTasks, changedTasks };
}

function buildPlan({ context, selected, carryOver, createdTasks, changedTasks }) {
  const { preference, goals, projects, notes, reviews, deliverables, londonDate } = context;
  const scheduling = preference.scheduling || {};
  const planning = preference.planning || {};
  const output = preference.output || {};
  const windowStart = scheduling.planningWindowStart || '04:00';
  const windowEnd = scheduling.planningWindowEnd || '21:00';
  const deepWork = scheduling.deepWorkPreferredTime || 'morning';
  const gym = scheduling.gymPreferredTime || 'afternoon';
  const carryOverTitles = unique(carryOver.map(taskLine));
  const selectedTitles = unique(selected.map(taskLine));
  const mustDo = selected.filter((task) => ['must', 'high'].includes(task.priority)).map(taskLine);
  const shouldDo = selected.filter((task) => ['should', 'medium'].includes(task.priority)).map(taskLine);
  const niceToHave = selected.filter((task) => ['nice', 'low'].includes(task.priority)).map(taskLine);
  const activeGoals = goals.filter((goal) => goal.status === 'active').slice(0, 3).map((goal) => goal.title);
  const focusProjects = projects.filter((project) => project.focusToday && !blockedExecutionStates.includes(project.executionState)).map((project) => project.name);
  const openDeliverables = deliverables.filter((deliverable) => deliverable.status === 'open').map((deliverable) => deliverable.title);
  const latestReview = reviews[0];
  const tomorrowItems = latestReview?.tomorrow || [];

  const top = selectedTitles.slice(0, 3);
  const focus = top.length
    ? `Move the highest-impact carry-over/project work forward: ${top.join('; ')}.`
    : 'Review the system and choose one meaningful execution outcome.';

  return {
    date: now,
    londonDate,
    startTime: now,
    endTime: new Date(now.getTime() + 8 * 60 * 60 * 1000),
    status: 'active',
    sessionType: 'start',
    focus,
    priorities: top,
    schedule: [
      { time: `${windowStart}-09:00`, title: 'Ramp and admin', activity: 'Review context, clear urgent small loops, set up the first work block.' },
      { time: '09:00-12:00', title: 'Deep work', activity: deepWork === 'morning' ? (top[0] || 'Primary execution task') : 'Highest-friction execution task.' },
      { time: '12:00-13:00', title: 'Reset', activity: 'Lunch, family/admin buffer, no new commitments.' },
      { time: '13:00-15:30', title: 'Execution block', activity: top[1] || 'Second selected task or project workspace.' },
      { time: '15:30-17:00', title: 'Gym/family buffer', activity: `Respect ${gym} gym preference and family constraints.` },
      { time: '17:00-18:30', title: 'Close loops', activity: top[2] || 'Review progress, update task notes, and prepare tomorrow handoff.' },
    ],
    mustDo: unique(mustDo),
    shouldDo: unique(shouldDo),
    niceToHave: unique(niceToHave),
    forgotten: unique([
      ...tomorrowItems,
      ...openDeliverables,
      ...carryOverTitles.filter((title) => !selectedTitles.includes(title)),
      planning.carryOverFirst !== false ? 'Carry-over first preference is active.' : '',
      scheduling.bufferTimeRequired !== false ? 'Leave buffer time; do not fill every gap.' : '',
      notes.length ? `${notes.length} raw notes remain available as context; do not treat them as planned work unless converted.` : '',
    ]),
    deliverables: unique(selected.filter((task) => task.deliverableRequired || task.expectedDeliverable).map((task) => task.expectedDeliverable || task.title)),
    winCondition: top.length
      ? [`Complete or materially advance ${top[0]}.`, 'Update task/project state with what changed and what remains.']
      : ['Create one concrete execution outcome and record it.'],
    insight: output.includeInsightOfTheDay === false
      ? ''
      : `Today works best as an execution day: protect the ${windowStart}-${windowEnd} window, keep context switching low, and let carry-over work earn its place before new ideas.`,
    motivationalPost: output.includeMotivationalPost === false ? { message: '', davidGogginsQuote: '', stoicQuote: '' } : {
      message: 'Do the part that creates proof, not the part that only creates motion.',
      davidGogginsQuote: output.includeDavidGogginsQuote === false ? '' : 'You are in danger of living a life so comfortable and soft, that you will die without ever realizing your true potential.',
      stoicQuote: output.includeStoicQuote === false ? '' : 'First say to yourself what you would be; and then do what you have to do.',
    },
    unclearItems: unique([
      !selected.length ? 'No open task or project action was available to schedule.' : '',
      createdTasks.length ? '' : 'No new project task workspace was created; selected work came from existing open tasks or capacity was already full.',
      changedTasks.length ? `${changedTasks.length} existing task workspace(s) were enriched or scheduled.` : '',
      focusProjects.length ? `Focus-today projects considered: ${focusProjects.join(', ')}.` : 'No focusToday project was marked for today.',
      activeGoals.length ? `Active goals used for alignment: ${activeGoals.join('; ')}.` : 'No active goals were found for alignment.',
    ]),
  };
}

function printSection(title, lines) {
  console.log(`\n### ${title}`);
  if (Array.isArray(lines)) {
    if (!lines.length) console.log('- None');
    else for (const line of lines) console.log(`- ${line}`);
  } else {
    console.log(lines || 'None');
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set.');
  await connectDB();

  const londonDate = getLondonDateKey(now);
  const context = await readContext(londonDate);
  const maxDailyTasks = Number(context.preference?.planning?.maxDailyTasks) || 5;
  const existing = selectExistingTasks({
    tasks: context.tasks,
    projects: context.projects,
    londonDate,
    maxDailyTasks,
  });
  const taskResult = await createOrUpdateProjectTasks({
    projects: context.projects,
    openTasks: existing.openTasks,
    selected: [...existing.selected],
    londonDate,
    maxDailyTasks,
  });
  const planPayload = buildPlan({
    context,
    selected: taskResult.selected,
    carryOver: existing.carryOver,
    createdTasks: taskResult.createdTasks,
    changedTasks: taskResult.changedTasks,
  });

  await DayPlan.updateMany({ status: 'active' }, { $set: { status: 'archived' } });
  const plan = await DayPlan.create(planPayload);
  const latest = await DayPlan.findOne({ londonDate }).sort({ startTime: -1, createdAt: -1 });
  if (!latest || String(latest._id) !== String(plan._id)) {
    throw new Error('Saved plan was not returned by the latest day-plan query.');
  }

  console.log(`Saved DayPlan ${plan._id} for ${londonDate}.`);
  console.log(`Created ${taskResult.createdTasks.length} task workspace(s); updated ${taskResult.changedTasks.length}.`);
  console.log(`Read collections: notes ${context.notes.length}, goals ${context.goals.length}, projects ${context.projects.length}, ideas ${context.ideas.length}, contextitems ${context.contextItems.length}, reviews ${context.reviews.length}, tasks ${context.tasks.length}, dayplans ${context.dayplans.length}.`);

  printSection("Today's Focus", plan.focus);
  printSection('Top 3 Priorities', plan.priorities);
  printSection('Day Plan', plan.schedule.map((item) => `${item.time} - ${item.title}: ${item.activity}`));
  printSection('Must Do', plan.mustDo);
  printSection('Should Do', plan.shouldDo);
  printSection('Nice To Have', plan.niceToHave);
  printSection('Things You May Be Forgetting', plan.forgotten);
  printSection('Suggested Task Outcomes', plan.deliverables);
  printSection('Win Condition', plan.winCondition);
  printSection('Insight of the Day', plan.insight);
  printSection('Motivational Post', [
    plan.motivationalPost?.message,
    plan.motivationalPost?.davidGogginsQuote,
    plan.motivationalPost?.stoicQuote,
  ].filter(Boolean));
  printSection('Unclear Items', plan.unclearItems);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect failures during error handling.
  }
  process.exit(1);
});
