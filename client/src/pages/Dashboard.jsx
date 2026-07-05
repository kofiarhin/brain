import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import {
  BrainHealth,
  Heatmap,
  InsightsList,
  ProjectRings,
  RadarChart,
  ScoreCard,
  StackedFocusBar,
  TrendSparklines
} from '../components/dashboard/DashboardCharts';

function MetricCard({ label, value, helper }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-3 text-3xl font-black text-slate-50">{value}</p>
    {helper && <p className="mt-1 text-sm text-slate-400">{helper}</p>}
  </div>;
}

function buildDashboardView(summary) {
  if (!summary) return null;

  return {
    ...summary,
    timeRemaining: {
      blocks: summary.overview.remainingBlocks,
      hours: summary.overview.timeRemainingHours,
      categories: summary.charts.focusAllocation,
    },
    brainHealth: {
      score: summary.overview.brainHealthScore,
      stats: [
        { label: 'Open loops', value: summary.counts.waiting },
        { label: 'Reviews due', value: summary.counts.reviewsDue },
        { label: 'Notes', value: summary.counts.notes },
        { label: 'Ideas', value: summary.counts.ideas },
      ],
    },
  };
}

export function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: api.dashboard.summary });
  const dashboard = useMemo(() => buildDashboardView(data), [data]);

  if (isLoading || !dashboard) return null;

  return <div className="space-y-6">
    <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300">Command Center</p>
          <h1 className="mt-2 text-4xl font-black text-slate-50">Dashboard</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">A cleaner operating view powered by one server-side dashboard summary.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
          Updated {new Date(dashboard.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {dashboard.plan?.focus && <p className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">{dashboard.plan.focus}</p>}
    </div>

    <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
      <ScoreCard score={dashboard.overview.todayScore} label={dashboard.overview.scoreLabel} />
      <MetricCard label="Open Loops" value={dashboard.counts.waiting} helper={`${dashboard.counts.openTasks} open tasks · ${dashboard.counts.openTaskOutputs} outputs`} />
      <MetricCard label="Time Remaining" value={`${dashboard.overview.timeRemainingHours}h`} helper={`${dashboard.overview.remainingBlocks} planned blocks left`} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <StackedFocusBar data={dashboard.charts.focusAllocation} />
      <TrendSparklines trends={dashboard.charts.trends} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Heatmap data={dashboard.charts.heatmap} />
      <InsightsList insights={dashboard.insights} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <ProjectRings projects={dashboard.charts.projectProgress} />
      <BrainHealth brainHealth={dashboard.brainHealth} />
    </section>

    <RadarChart data={dashboard.charts.lifeRadar} />
  </div>;
}
