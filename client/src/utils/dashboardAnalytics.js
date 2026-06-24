const EMPTY_ARRAY = [];
const DAY_MS = 24 * 60 * 60 * 1000;

export const CATEGORY_COLORS = {
  Work: '#22d3ee',
  Family: '#34d399',
  Health: '#a78bfa',
  Admin: '#f59e0b',
  Meetings: '#f472b6',
  Errands: '#60a5fa',
  Learning: '#2dd4bf',
  Other: '#64748b'
};

export function asArray(value) {
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
  return ['complete', 'completed', 'done', 'shipped'].includes(normalizeStatus(item?.status));
}

function isArchived(item) {
  return item?.archived || normalizeStatus(item?.status) === 'archived';
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

function isTodayOrEarlier(value) {
  const date = toDate(value);
  if (!date) return false;
  return date <= new Date(startOfDay().getTime() + DAY_MS - 1);
}

function dateForItem(item) {
  return toDate(item?.completedAt || item?.createdAt || item?.updatedAt || item?.date || item?.dueDate);
}

function getScheduleTitle(item) {
  if (typeof item === 'string') return item;
  return item?.title || item?.activity || item?.description || 'Untitled block';
}

export function parseScheduleRange(time = '') {
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
    return { label: day.toLocaleDateString(undefined, { weekday: 'short' }), date: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: count };
  });
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function buildDashboard(data) {
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
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const openTasks = tasks.filter(isOpen);
  const completedTasks = tasks.filter(isComplete);
  const openDeliverables = deliverables.filter(isOpen);
  const completedDeliverables = deliverables.filter(isComplete);
  const activeProjects = projects.filter((project) => isOpen(project) && normalizeStatus(project.status || 'active') !== 'inactive');
  const waitingItems = [...openTasks, ...openDeliverables, ...activeProjects, ...asArray(plan?.forgotten)].filter(isWaiting);
  const dueTasks = openTasks.filter((task) => isTodayOrEarlier(task.dueDate || task.date));
  const reviewsDue = reviews.filter((review) => isOpen(review) || isTodayOrEarlier(review.dueDate || review.date));

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
  const deliverableTrend = buildDailyBuckets(deliverables, isComplete);
  const noteTrend = buildDailyBuckets(notes);
  const heatmap = taskTrend.map((day, index) => ({ ...day, value: day.value + deliverableTrend[index].value + noteTrend[index].value }));

  const todayScore = clamp(62
    + completedTasks.filter((item) => dateForItem(item) && dateForItem(item) >= startOfDay()).length * 6
    + completedDeliverables.filter((item) => dateForItem(item) && dateForItem(item) >= startOfDay()).length * 8
    + (schedule.length ? 8 : -10)
    + (asArray(plan?.winCondition).length ? 6 : -8)
    - dueTasks.length * 5
    - waitingItems.length * 4
    - reviewsDue.length * 3);

  const brainHealthScore = clamp(100 - notes.length * 2 - waitingItems.length * 7 - reviewsDue.length * 6 + context.length * 2 + ideas.length);

  const lifeRadar = [
    { label: 'Work', value: clamp((focusAllocation.find((item) => item.label === 'Work')?.minutes || 0) / 240 * 100) },
    { label: 'Family', value: clamp((focusAllocation.find((item) => item.label === 'Family')?.minutes || 0) / 180 * 100) },
    { label: 'Health', value: clamp((focusAllocation.find((item) => item.label === 'Health')?.minutes || 0) / 90 * 100) },
    { label: 'Admin', value: clamp(((focusAllocation.find((item) => item.label === 'Admin')?.minutes || 0) + waitingItems.length * 20) / 180 * 100) },
    { label: 'Learning', value: clamp(((focusAllocation.find((item) => item.label === 'Learning')?.minutes || 0) + notes.length * 5 + ideas.length * 4) / 180 * 100) }
  ];

  const projectRings = activeProjects.slice(0, 4).map((project) => {
    const explicit = Number(project.progress ?? project.completion ?? project.percentComplete);
    const progress = Number.isFinite(explicit) ? clamp(explicit) : clamp(isWaiting(project) ? 35 : asArray(project.nextActions).length ? 55 : 20);
    return { id: project._id || project.id || project.name, name: project.name || project.title || 'Untitled project', progress };
  });

  const insights = [
    !schedule.length && 'No day schedule is saved, so time allocation is incomplete.',
    waitingItems.length > 0 && `${waitingItems.length} open loop${waitingItems.length === 1 ? '' : 's'} need follow-up or confirmation.`,
    dueTasks.length > 0 && `${dueTasks.length} task${dueTasks.length === 1 ? '' : 's'} are due now or earlier.`,
    focusAllocation.length && (remainingByCategory.Admin || 0) > (remainingByCategory.Work || 0) && 'Admin load is higher than remaining deep work today.',
    reviewsDue.length > 0 && `${reviewsDue.length} review${reviewsDue.length === 1 ? '' : 's'} need attention.`,
    heatmap.every((day) => day.value === 0) && 'Not enough dated activity exists yet for trend analysis.'
  ].filter(Boolean).slice(0, 5);

  if (!insights.length) insights.push('System looks stable. Keep closing visible loops.');

  return {
    plan,
    todayScore,
    scoreLabel: todayScore >= 80 ? 'On track' : todayScore >= 60 ? 'Stable' : todayScore >= 40 ? 'Needs attention' : 'Overloaded',
    kpis: { openTasks: openTasks.length, openDeliverables: openDeliverables.length, activeProjects: activeProjects.length, waiting: waitingItems.length, reviewsDue: reviewsDue.length },
    timeRemaining: { blocks: remainingRanges.length, hours: remainingMinutes / 60, categories: Object.entries(remainingByCategory).map(([label, minutes]) => ({ label, minutes })) },
    focusAllocation,
    heatmap,
    projectRings,
    trends: [{ label: 'Tasks completed', data: taskTrend }, { label: 'Deliverables shipped', data: deliverableTrend }, { label: 'Notes created', data: noteTrend }],
    lifeRadar,
    brainHealth: { score: brainHealthScore, stats: [{ label: 'Notes', value: notes.length }, { label: 'Ideas', value: ideas.length }, { label: 'Context', value: context.length }, { label: 'Reviews due', value: reviewsDue.length }, { label: 'Open loops', value: waitingItems.length }] },
    globeNodes: [{ label: 'Notes', count: notes.length, color: '#22d3ee' }, { label: 'Tasks', count: tasks.length, color: '#a78bfa' }, { label: 'Projects', count: projects.length, color: '#34d399' }, { label: 'Deliverables', count: deliverables.length, color: '#f59e0b' }, { label: 'Goals', count: goals.length, color: '#f472b6' }, { label: 'Reviews', count: reviews.length, color: '#60a5fa' }, { label: 'Context', count: context.length, color: '#2dd4bf' }, { label: 'Ideas', count: ideas.length, color: '#c084fc' }],
    insights
  };
}
