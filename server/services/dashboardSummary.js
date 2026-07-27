import { Note } from '../models/Note.js';
import { Task } from '../models/Task.js';
import { Deliverable } from '../models/Deliverable.js';
import { Goal } from '../models/Goal.js';
import { Project } from '../models/Project.js';
import { Idea } from '../models/Idea.js';
import { Context } from '../models/Context.js';
import { Review } from '../models/Review.js';
import { DayPlan } from '../models/DayPlan.js';
import { getLondonDateKey } from './londonDate.js';

const EMPTY_ARRAY = [];
const DAY_MS = 24 * 60 * 60 * 1000;
const CATEGORY_COLORS = {
  Work: '#22d3ee',
  Family: '#34d399',
  Health: '#a78bfa',
  Admin: '#f59e0b',
  Meetings: '#f472b6',
  Errands: '#60a5fa',
  Learning: '#2dd4bf',
  Other: '#64748b',
};
const londonTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function asArray(value) {
  return Array.isArray(value) ? value : EMPTY_ARRAY;
}

function normalizeStatus(value = '') {
  return String(value).toLowerCase().replace(/[_-]/g, ' ').trim();
}

function textOf(item) {
  if (typeof item === 'string') return item;
  return [item?.title, item?.name, item?.activity, item?.description, item?.notes, asArray(item?.nextActions).join(' ')]
    .filter(Boolean)
    .join(' ');
}

function isComplete(item) {
  if (item?.completed || item?.isComplete || item?.done) return true;
  return ['complete', 'completed', 'done', 'shipped'].includes(normalizeStatus(item?.status || item?.outcome));
}

function isArchived(item) {
  return item?.archived || normalizeStatus(item?.status || item?.outcome) === 'archived';
}

function isOpen(item) {
  return !isComplete(item) && !isArchived(item);
}

function isWaiting(item) {
  const text = `${normalizeStatus(item?.status)} ${textOf(item)}`.toLowerCase();
  return /waiting|blocked|blocker|follow up|follow-up|confirm|contact|reply|callback|call back/.test(text)
    || asArray(item?.blockers).length > 0;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function londonDateKey(value) {
  const date = toDate(value);
  return date ? getLondonDateKey(date) : '';
}

function londonNowMinutes(date = new Date()) {
  const parts = Object.fromEntries(londonTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function isTodayOrEarlier(value, todayKey = getLondonDateKey(new Date())) {
  const dateKey = londonDateKey(value);
  return Boolean(dateKey && dateKey <= todayKey);
}

function dateForItem(item) {
  return toDate(item?.completedAt || item?.createdAt || item?.updatedAt || item?.date || item?.dueDate);
}

function getScheduleTitle(item) {
  if (typeof item === 'string') return item;
  return item?.title || item?.activity || item?.description || 'Untitled block';
}

function parseScheduleRange(time = '') {
  const raw = String(time);
  const compact = raw.match(/^(\d{1,2}):(\d{2})(\d{1,2}):(\d{2})$/);
  const matches = compact
    ? [[compact[1], compact[2]], [compact[3], compact[4]]]
    : [...raw.matchAll(/(\d{1,2}):(\d{2})/g)].map((match) => [match[1], match[2]]);
  if (!matches.length) return null;
  const start = Number(matches[0][0]) * 60 + Number(matches[0][1]);
  const end = matches[1] ? Number(matches[1][0]) * 60 + Number(matches[1][1]) : start + 60;
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return { start, end: end > start ? end : start + 60, minutes: end > start ? end - start : 60 };
}

function categoryForText(text = '') {
  const value = text.toLowerCase();
  if (/family|ato|laura|school|home|pickup|drop/.test(value)) return 'Family';
  if (/gym|workout|walk|run|health|prayer|meditation|sleep|rest/.test(value)) return 'Health';
  if (/meeting|call|appointment|standup/.test(value)) return 'Meetings';
  if (/hospital|loan|admin|email|follow|contact|reply|invoice|finance/.test(value)) return 'Admin';
  if (/errand|shop|chores|drive/.test(value)) return 'Errands';
  if (/learn|study|read|course|research/.test(value)) return 'Learning';
  if (/deep|work|code|build|fix|deploy|write|ship|brain|project/.test(value)) return 'Work';
  return 'Other';
}

function buildDailyBuckets(items, predicate = () => true) {
  return Array.from({ length: 14 }, (_, index) => {
    const day = new Date(startOfDay().getTime() - (13 - index) * DAY_MS);
    const next = new Date(day.getTime() + DAY_MS);
    const count = items.filter((item) => {
      const date = dateForItem(item);
      return date && date >= day && date < next && predicate(item);
    }).length;
    return {
      label: day.toLocaleDateString(undefined, { weekday: 'short' }),
      date: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: count,
    };
  });
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function buildSummary(data) {
  const plan = data.plan;
  const notes = asArray(data.notes);
  const tasks = asArray(data.tasks);
  const deliverables = asArray(data.deliverables);
  const projects = asArray(data.projects);
  const ideas = asArray(data.ideas);
  const context = asArray(data.context);
  const reviews = asArray(data.reviews);
  const goals = asArray(data.goals);
  const schedule = asArray(plan?.schedule);
  const todayKey = getLondonDateKey(new Date());
  const nowMinutes = londonNowMinutes();

  const openTasks = tasks.filter(isOpen);
  const completedTasks = tasks.filter(isComplete);
  const openTaskOutputs = deliverables.filter(isOpen);
  const completedTaskOutputs = deliverables.filter(isComplete);
  const activeProjects = projects.filter((project) => isOpen(project) && normalizeStatus(project.status || 'active') !== 'inactive');
  const waitingItems = [...openTasks, ...openTaskOutputs, ...activeProjects, ...asArray(plan?.forgotten)].filter(isWaiting);
  const dueTasks = openTasks.filter((task) => isTodayOrEarlier(task.dueDate || task.date, todayKey));
  const reviewsDue = reviews.filter((review) => isOpen(review) || isTodayOrEarlier(review.dueDate || review.date, todayKey));

  const scheduleRanges = schedule.map((block) => ({ block, range: parseScheduleRange(block?.time) }));
  const remainingRanges = scheduleRanges.filter(({ range }) => range && range.end > nowMinutes);
  const remainingMinutes = remainingRanges.reduce((sum, item) => sum + Math.max(item.range.end - Math.max(item.range.start, nowMinutes), 0), 0);

  const focusAllocation = Object.entries(scheduleRanges.reduce((acc, { block, range }) => {
    const category = categoryForText(getScheduleTitle(block));
    acc[category] = (acc[category] || 0) + (range?.minutes || 60);
    return acc;
  }, {})).map(([label, minutes]) => ({ label, minutes, color: CATEGORY_COLORS[label] || CATEGORY_COLORS.Other }));

  const remainingByCategory = remainingRanges.reduce((acc, { block, range }) => {
    const category = categoryForText(getScheduleTitle(block));
    acc[category] = (acc[category] || 0) + Math.max(range.end - Math.max(range.start, nowMinutes), 0);
    return acc;
  }, {});

  const taskTrend = buildDailyBuckets(tasks, isComplete);
  const taskOutputTrend = buildDailyBuckets(deliverables, isComplete);
  const noteTrend = buildDailyBuckets(notes);
  const heatmap = taskTrend.map((day, index) => ({ ...day, value: day.value + taskOutputTrend[index].value + noteTrend[index].value }));

  const todayScore = clamp(62
    + completedTasks.filter((item) => dateForItem(item) && londonDateKey(dateForItem(item)) === todayKey).length * 6
    + completedTaskOutputs.filter((item) => dateForItem(item) && londonDateKey(dateForItem(item)) === todayKey).length * 8
    + (schedule.length ? 8 : -10)
    + (asArray(plan?.winCondition).length ? 6 : -8)
    - dueTasks.length * 5
    - waitingItems.length * 4
    - reviewsDue.length * 3);

  const brainHealthScore = clamp(100 - notes.length * 2 - waitingItems.length * 7 - reviewsDue.length * 6 + context.length * 2 + ideas.length);
  const insights = [
    !schedule.length && 'No day schedule is saved, so time allocation is incomplete.',
    waitingItems.length > 0 && `${waitingItems.length} open loop${waitingItems.length === 1 ? '' : 's'} need follow-up or confirmation.`,
    dueTasks.length > 0 && `${dueTasks.length} task${dueTasks.length === 1 ? '' : 's'} are due now or earlier.`,
    focusAllocation.length && (remainingByCategory.Admin || 0) > (remainingByCategory.Work || 0) && 'Admin load is higher than remaining deep work today.',
    reviewsDue.length > 0 && `${reviewsDue.length} review${reviewsDue.length === 1 ? '' : 's'} need attention.`,
    heatmap.every((day) => day.value === 0) && 'Not enough dated activity exists yet for trend analysis.',
  ].filter(Boolean).slice(0, 4);

  if (!insights.length) insights.push('System looks stable. Keep closing visible loops.');

  return {
    generatedAt: new Date().toISOString(),
    plan: plan ? { focus: plan.focus || '', scheduleCount: schedule.length } : null,
    overview: {
      todayScore,
      scoreLabel: todayScore >= 80 ? 'On track' : todayScore >= 60 ? 'Stable' : todayScore >= 40 ? 'Needs attention' : 'Overloaded',
      timeRemainingHours: Number((remainingMinutes / 60).toFixed(1)),
      remainingBlocks: remainingRanges.length,
      brainHealthScore,
    },
    counts: {
      notes: notes.length,
      ideas: ideas.length,
      context: context.length,
      goals: goals.length,
      tasks: tasks.length,
      openTasks: openTasks.length,
      completedTasks: completedTasks.length,
      taskOutputs: deliverables.length,
      openTaskOutputs: openTaskOutputs.length,
      activeProjects: activeProjects.length,
      waiting: waitingItems.length,
      reviewsDue: reviewsDue.length,
    },
    charts: {
      focusAllocation,
      heatmap,
      trends: [
        { label: 'Tasks completed', data: taskTrend },
        { label: 'Task outputs shipped', data: taskOutputTrend },
        { label: 'Notes created', data: noteTrend },
      ],
      projectProgress: activeProjects.slice(0, 4).map((project) => {
        const explicit = Number(project.progress ?? project.completion ?? project.progressPercent ?? project.percentComplete);
        return {
          id: project._id || project.id || project.name,
          name: project.name || project.title || 'Untitled project',
          progress: Number.isFinite(explicit) ? clamp(explicit) : clamp(isWaiting(project) ? 35 : asArray(project.nextActions || project.nextActionableSteps).length ? 55 : 20),
        };
      }),
      lifeRadar: [
        { label: 'Work', value: clamp((focusAllocation.find((item) => item.label === 'Work')?.minutes || 0) / 240 * 100) },
        { label: 'Family', value: clamp((focusAllocation.find((item) => item.label === 'Family')?.minutes || 0) / 180 * 100) },
        { label: 'Health', value: clamp((focusAllocation.find((item) => item.label === 'Health')?.minutes || 0) / 90 * 100) },
        { label: 'Admin', value: clamp(((focusAllocation.find((item) => item.label === 'Admin')?.minutes || 0) + waitingItems.length * 20) / 180 * 100) },
        { label: 'Learning', value: clamp(((focusAllocation.find((item) => item.label === 'Learning')?.minutes || 0) + notes.length * 5 + ideas.length * 4) / 180 * 100) },
      ],
    },
    insights,
  };
}

async function recent(model, limit = 500) {
  return model.find({}).sort({ createdAt: -1 }).limit(limit);
}

export async function getDashboardSummary() {
  const todayKey = getLondonDateKey(new Date());
  const [plan, notes, tasks, deliverables, projects, ideas, context, reviews, goals] = await Promise.all([
    DayPlan.findOne({ londonDate: todayKey }).sort({ startTime: -1, createdAt: -1 }),
    recent(Note),
    recent(Task),
    recent(Deliverable),
    recent(Project),
    recent(Idea),
    recent(Context),
    recent(Review),
    recent(Goal),
  ]);

  return buildSummary({ plan, notes, tasks, deliverables, projects, ideas, context, reviews, goals });
}
