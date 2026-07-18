import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import {
  BrainRadar,
  FocusDonut,
  MissionHero,
  ProductivityPulse,
  ProjectBubbleChart,
  WeeklyMomentum,
} from '../components/dashboard/DashboardCharts';

const EMPTY_ARRAY = [];

function findStat(stats = EMPTY_ARRAY, label) {
  return stats.find((item) => item.label === label)?.value || 0;
}

function DashboardState({ title, children }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-slate-100">
    <h1 className="text-2xl font-bold">{title}</h1>
    <p className="mt-2 text-sm text-slate-400">{children}</p>
  </div>;
}

function buildDashboardView(summary) {
  if (!summary) return null;

  const overview = summary.overview || {
    todayScore: summary.todayScore ?? 0,
    scoreLabel: summary.scoreLabel || 'Needs attention',
    timeRemainingHours: summary.timeRemaining?.hours ?? 0,
    remainingBlocks: summary.timeRemaining?.blocks ?? 0,
    brainHealthScore: summary.brainHealth?.score ?? 0,
  };
  const counts = summary.counts || {
    waiting: summary.kpis?.waiting ?? 0,
    openTasks: summary.kpis?.openTasks ?? 0,
    openTaskOutputs: summary.kpis?.openTaskOutputs ?? 0,
    reviewsDue: summary.kpis?.reviewsDue ?? 0,
    notes: findStat(summary.brainHealth?.stats, 'Notes'),
    ideas: findStat(summary.brainHealth?.stats, 'Ideas'),
  };
  const charts = summary.charts || {
    focusAllocation: summary.focusAllocation || EMPTY_ARRAY,
    heatmap: summary.heatmap || EMPTY_ARRAY,
    trends: summary.trends || EMPTY_ARRAY,
    projectProgress: summary.projectRings || EMPTY_ARRAY,
    lifeRadar: summary.lifeRadar || EMPTY_ARRAY,
  };

  return {
    ...summary,
    overview,
    counts,
    charts,
    generatedAt: summary.generatedAt || new Date().toISOString(),
    brainHealth: {
      score: overview.brainHealthScore,
      stats: [
        { label: 'Open loops', value: counts.waiting },
        { label: 'Reviews due', value: counts.reviewsDue },
        { label: 'Notes', value: counts.notes },
        { label: 'Ideas', value: counts.ideas },
      ],
    },
  };
}

export function Dashboard() {
  const { data, error, isError, isLoading } = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: api.dashboard.summary });
  const dashboard = useMemo(() => buildDashboardView(data), [data]);

  if (isLoading) return <DashboardState title="Loading dashboard">Fetching your latest brain snapshot.</DashboardState>;
  if (isError) return <DashboardState title="Dashboard unavailable">{error?.message || 'Could not load dashboard data.'}</DashboardState>;
  if (!dashboard) return <DashboardState title="No dashboard data">Capture notes, tasks, projects, or a day plan to populate Mission Control.</DashboardState>;

  return <div className="relative -m-3 min-h-screen overflow-hidden rounded-[2rem] bg-slate-950 p-3 sm:-m-6 sm:p-6">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_82%_38%,rgba(139,92,246,0.14),transparent_28%)]" />
    <div className="relative space-y-5">
      <header className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-800/80 bg-black/30 p-5 backdrop-blur md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-300">Mission Control</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-50">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">A graph-first overview of today, project health, focus load, and system balance.</p>
        </div>
        <div className="w-fit rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-slate-300">
          Updated {new Date(dashboard.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      <main className="grid gap-5 xl:grid-cols-[1.24fr_0.76fr]">
        <MissionHero dashboard={dashboard} />
        <WeeklyMomentum trends={dashboard.charts.trends} />

        <FocusDonut data={dashboard.charts.focusAllocation} />
        <ProjectBubbleChart projects={dashboard.charts.projectProgress} />
        <BrainRadar data={dashboard.charts.lifeRadar} brainHealth={dashboard.brainHealth} />
        <ProductivityPulse data={dashboard.charts.heatmap} />
      </main>
    </div>
  </div>;
}
