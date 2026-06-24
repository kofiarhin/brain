import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';

const EMPTY_ARRAY = [];
const CHART_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#f472b6', '#60a5fa'];
const DAY_MS = 24 * 60 * 60 * 1000;

function asArray(value) {
  return Array.isArray(value) ? value : EMPTY_ARRAY;
}

function normalizeStatus(status = '') {
  return String(status).toLowerCase().replace(/[_-]/g, ' ');
}

function isOpen(item) {
  const status = normalizeStatus(item?.status || 'open');
  return !['complete', 'completed', 'done', 'archived'].includes(status);
}

function isComplete(item) {
  return ['complete', 'completed', 'done'].includes(normalizeStatus(item?.status));
}

function isBlocked(item) {
  const status = normalizeStatus(item?.status);
  return status.includes('blocked') || asArray(item?.blockers).length > 0;
}

function isWaiting(item) {
  const text = `${item?.title || item?.name || ''} ${item?.description || ''} ${asArray(item?.nextActions).join(' ')}`.toLowerCase();
  return normalizeStatus(item?.status).includes('waiting') || text.includes('waiting on') || text.includes('follow up');
}

function getTitle(item) {
  if (typeof item === 'string') return item;
  return item?.title || item?.activity || item?.description || 'Untitled block';
}

function parseStartMinutes(time = '') {
  const match = String(time).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseRangeMinutes(time = '') {
  const matches = [...String(time).matchAll(/(\d{1,2}):(\d{2})/g)].map((match) => Number(match[1]) * 60 + Number(match[2]));
  if (matches.length >= 2 && matches[1] > matches[0]) return matches[1] - matches[0];
  return 60;
}

function categoryForBlock(block) {
  const text = `${block?.title || ''} ${block?.activity || ''} ${block?.description || ''}`.toLowerCase();
  if (/gym|workout|run|health|walk/.test(text)) return 'Health';
  if (/family|laura|ato|school|pickup|drop/.test(text)) return 'Family';
  if (/admin|email|inbox|errand|chores/.test(text)) return 'Admin';
  if (/meeting|call|client|follow/.test(text)) return 'Meetings';
  if (/buffer|break|lunch|dinner|rest/.test(text)) return 'Recovery';
  return 'Deep Work';
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDueTodayOrEarlier(item) {
  if (!item?.dueDate && !item?.date) return false;
  const date = new Date(item.dueDate || item.date);
  return date <= new Date(startOfDay().getTime() + DAY_MS - 1);
}

function buildDashboard(data) {
  const notes = asArray(data.notes);
  const tasks = asArray(data.tasks);
  const deliverables = asArray(data.deliverables);
  const projects = asArray(data.projects);
  const ideas = asArray(data.ideas);
  const context = asArray(data.context);
  const reviews = asArray(data.reviews);
  const schedule = asArray(data.plan?.schedule);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const activeProjects = projects.filter((project) => normalizeStatus(project.status || 'active') === 'active');
  const openTasks = tasks.filter(isOpen);
  const openDeliverables = deliverables.filter(isOpen);
  const completedTasksThisWeek = tasks.filter((task) => isComplete(task) && task.completedAt && Date.now() - new Date(task.completedAt).getTime() < 7 * DAY_MS);
  const completedBlocks = schedule.filter((block) => block.completed || normalizeStatus(block.status).includes('complete'));
  const overdueBlocks = schedule.filter((block) => !block.completed && parseStartMinutes(block?.time) !== null && parseStartMinutes(block.time) < nowMinutes);

  const focusAllocation = Object.entries(schedule.reduce((acc, block) => {
    const category = categoryForBlock(block);
    acc[category] = (acc[category] || 0) + parseRangeMinutes(block?.time);
    return acc;
  }, {})).map(([label, value], index) => ({ label, value, color: CHART_COLORS[index % CHART_COLORS.length] }));

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfDay().getTime() - (6 - index) * DAY_MS);
    const nextDay = new Date(day.getTime() + DAY_MS);
    const count = tasks.filter((task) => task.completedAt && new Date(task.completedAt) >= day && new Date(task.completedAt) < nextDay).length;
    return { label: day.toLocaleDateString(undefined, { weekday: 'short' }), value: count };
  });

  const pipeline = {
    Planned: openDeliverables.filter((item) => ['open', 'planned', ''].includes(normalizeStatus(item.status))).length,
    'In Progress': openDeliverables.filter((item) => normalizeStatus(item.status).includes('progress')).length,
    Completed: deliverables.filter(isComplete).length,
    Blocked: deliverables.filter(isBlocked).length
  };

  const upcomingBlocks = schedule
    .map((block, index) => ({ ...block, index, startMinutes: parseStartMinutes(block?.time) }))
    .filter((block) => block.startMinutes !== null && block.startMinutes >= nowMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  return {
    plan: data.plan,
    kpis: [
      { label: 'Tasks Due', value: openTasks.filter(isDueTodayOrEarlier).length, hint: `${openTasks.length} open` },
      { label: 'Deliverables', value: openDeliverables.length, hint: `${deliverables.filter(isComplete).length} complete` },
      { label: 'Projects Active', value: activeProjects.length, hint: `${projects.length} total` },
      { label: 'Waiting On', value: [...openTasks, ...activeProjects].filter(isWaiting).length, hint: 'follow-ups' }
    ],
    focusAllocation,
    timelineHealth: [
      { label: 'Planned blocks', value: schedule.length },
      { label: 'Completed blocks', value: completedBlocks.length },
      { label: 'Remaining blocks', value: Math.max(schedule.length - completedBlocks.length - overdueBlocks.length, 0) },
      { label: 'Overdue blocks', value: overdueBlocks.length }
    ],
    activeProjects: activeProjects.slice(0, 6).map((project) => {
      const actions = asArray(project.nextActions);
      const blockers = asArray(project.blockers).length;
      const progress = Math.max(10, Math.min(85, blockers ? 35 : actions.length ? 55 : 70));
      return { ...project, progress };
    }),
    brainHealth: [
      { label: 'Notes count', value: notes.length },
      { label: 'Unprocessed notes', value: notes.length },
      { label: 'Ideas count', value: ideas.length },
      { label: 'Context entries', value: context.length },
      { label: 'Reviews due', value: reviews.some((review) => new Date(review.date) >= startOfDay()) ? 0 : 1 }
    ],
    weeklyProductivity: lastSevenDays,
    pipeline,
    upcoming: { next: upcomingBlocks[0], list: upcomingBlocks.slice(1, 4) },
    insights: [
      schedule.length ? `${Math.round((overdueBlocks.length / schedule.length) * 100)}% of planned blocks are behind the current clock.` : 'No schedule saved yet; run the planning workflow before execution.',
      activeProjects.length > 3 ? 'Active project load is high; protect one mission-critical deliverable.' : 'Project load is focused enough for meaningful execution.',
      completedTasksThisWeek.length ? `${completedTasksThisWeek.length} tasks completed in the last 7 days.` : 'No completed tasks logged this week; close one visible loop today.'
    ]
  };
}

function StatGrid({ items }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4" key={item.label}>
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
    <p className="mt-3 text-3xl font-bold text-slate-50">{item.value}</p>
    {item.hint && <p className="mt-1 text-xs text-cyan-300">{item.hint}</p>}
  </div>)}</div>;
}

function PieChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;
  const gradient = total ? data.map((item) => {
    const start = offset;
    const end = offset + (item.value / total) * 100;
    offset = end;
    return `${item.color} ${start}% ${end}%`;
  }).join(', ') : '#1e293b 0 100%';
  return <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
    <div className="mx-auto h-44 w-44 shrink-0 rounded-full border border-slate-700 shadow-[0_0_40px_rgba(34,211,238,0.15)]" style={{ background: `conic-gradient(${gradient})` }} />
    <div className="grid flex-1 gap-2">{data.length ? data.map((item) => <div className="flex items-center justify-between gap-3 text-sm" key={item.label}>
      <span className="flex items-center gap-2 text-slate-300"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
      <span className="font-semibold text-slate-100">{Math.round(item.value / 60)}h</span>
    </div>) : <p className="text-sm text-slate-500">No schedule blocks to aggregate.</p>}</div>
  </div>;
}

function BarChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="flex h-44 items-end gap-2">{data.map((item) => <div className="flex flex-1 flex-col items-center gap-2" key={item.label}>
    <div className="flex h-32 w-full items-end rounded-t-xl bg-slate-950/70"><div className="w-full rounded-t-xl bg-gradient-to-t from-cyan-500 to-violet-400" style={{ height: `${Math.max((item.value / max) * 100, item.value ? 12 : 3)}%` }} /></div>
    <span className="text-xs text-slate-500">{item.label}</span>
  </div>)}</div>;
}

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: async () => {
      const [planResult, notes, tasks, deliverables, projects, ideas, context, reviews] = await Promise.allSettled([
        api.dayPlans.latest(), api.notes.list(), api.tasks.list(), api.deliverables.list(), api.projects.list(), api.ideas.list(), api.context.list(), api.reviews.list()
      ]);
      return buildDashboard({
        plan: planResult.status === 'fulfilled' ? planResult.value : null,
        notes: notes.status === 'fulfilled' ? notes.value : [],
        tasks: tasks.status === 'fulfilled' ? tasks.value : [],
        deliverables: deliverables.status === 'fulfilled' ? deliverables.value : [],
        projects: projects.status === 'fulfilled' ? projects.value : [],
        ideas: ideas.status === 'fulfilled' ? ideas.value : [],
        context: context.status === 'fulfilled' ? context.value : [],
        reviews: reviews.status === 'fulfilled' ? reviews.value : []
      });
    }
  });

  const dashboard = useMemo(() => data, [data]);
  if (isLoading || !dashboard) return <p>Loading mission control...</p>;

  return <div className="space-y-6">
    <div className="rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-5 shadow-2xl sm:p-7">
      <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-300">Mission Control</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-50 sm:text-4xl">Dashboard</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">High-level analytics for priorities, capacity, brain inputs, and execution health. The Day Plan page remains the source for the actual timeline.</p>
    </div>

    <StatGrid items={dashboard.kpis} />

    <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Card title="Focus Allocation"><PieChart data={dashboard.focusAllocation} /></Card>
      <Card title="Timeline Health"><StatGrid items={dashboard.timelineHealth} /></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card title="Project Progress"><div className="space-y-4">{dashboard.activeProjects.length ? dashboard.activeProjects.map((project) => <div key={project._id || project.name}>
        <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-200">{project.name}</span><span className="text-cyan-300">{project.progress}%</span></div>
        <div className="mt-2 h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${project.progress}%` }} /></div>
      </div>) : <p className="text-sm text-slate-500">No active projects found.</p>}</div></Card>
      <Card title="Brain Health"><div className="grid gap-3 sm:grid-cols-2">{dashboard.brainHealth.map((item) => <div className="rounded-xl bg-slate-950/60 p-3" key={item.label}><p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold">{item.value}</p></div>)}</div></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <Card title="Weekly Productivity"><BarChart data={dashboard.weeklyProductivity} /></Card>
      <Card title="Deliverables Pipeline"><div className="space-y-3">{Object.entries(dashboard.pipeline).map(([label, value]) => <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3" key={label}><span className="text-sm text-slate-300">{label}</span><span className="text-xl font-bold text-slate-50">{value}</span></div>)}</div></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card title="Upcoming"><div className="space-y-4">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4"><p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Next event</p><p className="mt-2 font-semibold text-slate-100">{dashboard.upcoming.next ? getTitle(dashboard.upcoming.next) : 'No upcoming scheduled events'}</p></div>
        <div className="space-y-2">{dashboard.upcoming.list.length ? dashboard.upcoming.list.map((item) => <p className="rounded-xl bg-slate-950/60 p-3 text-sm text-slate-300" key={`${item.time}-${item.index}`}>{item.time} · {getTitle(item)}</p>) : <p className="text-sm text-slate-500">No additional upcoming events.</p>}</div>
      </div></Card>
      <Card title="AI Insights"><ul className="space-y-3">{dashboard.insights.map((insight) => <li className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm leading-relaxed text-slate-300" key={insight}>{insight}</li>)}</ul></Card>
    </section>
  </div>;
}
