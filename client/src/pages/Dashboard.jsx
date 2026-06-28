import { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';
import {
  BrainHealth,
  Heatmap,
  InsightsList,
  OpenLoopsCard,
  ProjectRings,
  RadarChart,
  ScoreCard,
  StackedFocusBar,
  TimeRemainingCard,
  TrendSparklines
} from '../components/dashboard/DashboardCharts';
import { buildDashboard } from '../utils/dashboardAnalytics';

const BrainGlobe = lazy(() => import('../components/three/BrainGlobe'));

async function getDashboardData() {
  const [planResult, notes, tasks, deliverables, projects, ideas, context, reviews, goals] = await Promise.allSettled([
    api.dayPlans.latest(),
    api.notes.list(),
    api.tasks.list(),
    api.deliverables.list(),
    api.projects.list(),
    api.ideas.list(),
    api.context.list(),
    api.reviews.list(),
    api.goals.list()
  ]);

  return buildDashboard({
    plan: planResult.status === 'fulfilled' ? planResult.value : null,
    notes: notes.status === 'fulfilled' ? notes.value : [],
    tasks: tasks.status === 'fulfilled' ? tasks.value : [],
    deliverables: deliverables.status === 'fulfilled' ? deliverables.value : [],
    projects: projects.status === 'fulfilled' ? projects.value : [],
    ideas: ideas.status === 'fulfilled' ? ideas.value : [],
    context: context.status === 'fulfilled' ? context.value : [],
    reviews: reviews.status === 'fulfilled' ? reviews.value : [],
    goals: goals.status === 'fulfilled' ? goals.value : []
  });
}

export function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'analytics', 'v2'], queryFn: getDashboardData });
  const dashboard = useMemo(() => data, [data]);

  if (isLoading || !dashboard) return null;

  return <div className="space-y-6">
    <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl sm:p-7">
      <p className="text-sm font-medium uppercase tracking-[0.28em] text-cyan-300">Mission Control</p>
      <h1 className="mt-2 text-4xl font-black text-slate-50">Dashboard</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">High-level overview of execution, open loops, focus, and brain health. Day Plan remains the source for the actual timeline.</p>
      {dashboard.plan?.focus && <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">{dashboard.plan.focus}</p>}
    </div>

    <section className="grid gap-4 xl:grid-cols-3">
      <ScoreCard score={dashboard.todayScore} label={dashboard.scoreLabel} />
      <OpenLoopsCard kpis={dashboard.kpis} />
      <TimeRemainingCard timeRemaining={dashboard.timeRemaining} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <Heatmap data={dashboard.heatmap} />
      <StackedFocusBar data={dashboard.focusAllocation} />
    </section>

    <ProjectRings projects={dashboard.projectRings} />
    <TrendSparklines trends={dashboard.trends} />

    <section className="grid gap-4 xl:grid-cols-2">
      <RadarChart data={dashboard.lifeRadar} />
      <BrainHealth brainHealth={dashboard.brainHealth} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <InsightsList insights={dashboard.insights} />
      <Card title="Brain Globe">
        <p className="mb-4 text-sm text-slate-400">Small interactive map of Brain OS collections. Three.js is used only here.</p>
        <Suspense fallback={<div className="h-72 rounded-2xl bg-slate-950/70" />}>
          <BrainGlobe nodes={dashboard.globeNodes} />
        </Suspense>
      </Card>
    </section>
  </div>;
}
