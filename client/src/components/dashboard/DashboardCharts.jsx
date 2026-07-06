const EMPTY_ARRAY = [];

function clampPercent(value = 0) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function formatPercent(value = 0) {
  return `${Math.round(clampPercent(value))}%`;
}

function ChartPanel({ eyebrow, title, children, className = '' }) {
  return <section className={`overflow-hidden rounded-[1.75rem] border border-slate-800/80 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 ${className}`}>
    {(eyebrow || title) && <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-cyan-300/90">{eyebrow}</p>}
        {title && <h2 className="mt-2 text-xl font-black text-slate-50">{title}</h2>}
      </div>
    </div>}
    {children}
  </section>;
}

function MiniMetric({ label, value, progress = 0 }) {
  return <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-2xl font-black text-slate-50">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.8)]" />
    </div>
    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-700" style={{ width: `${clampPercent(progress)}%` }} />
    </div>
  </div>;
}

export function MissionHero({ dashboard }) {
  const score = clampPercent(dashboard.overview.todayScore);
  const health = clampPercent(dashboard.overview.brainHealthScore);
  const radius = 108;
  const innerRadius = 76;
  const circumference = 2 * Math.PI * radius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const focusText = dashboard.plan?.focus || dashboard.focus || 'Today\'s mission is ready.';

  return <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.20),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 shadow-2xl shadow-cyan-950/30 sm:p-7 xl:col-span-2">
    <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
    <div className="absolute bottom-0 left-1/2 h-40 w-96 -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />

    <div className="relative grid gap-8 lg:grid-cols-[320px_1fr] lg:items-center">
      <div className="flex justify-center">
        <div className="relative h-72 w-72">
          <div className="absolute inset-3 rounded-full bg-cyan-300/10 blur-2xl" />
          <svg viewBox="0 0 280 280" className="relative h-72 w-72 -rotate-90">
            <circle cx="140" cy="140" r={radius} fill="none" stroke="rgb(30 41 59)" strokeWidth="18" />
            <circle cx="140" cy="140" r={radius} fill="none" stroke="url(#missionGradient)" strokeWidth="18" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - (score / 100) * circumference} />
            <circle cx="140" cy="140" r={innerRadius} fill="none" stroke="rgb(30 41 59)" strokeWidth="8" />
            <circle cx="140" cy="140" r={innerRadius} fill="none" stroke="url(#healthGradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={innerCircumference} strokeDashoffset={innerCircumference - (health / 100) * innerCircumference} />
            <defs>
              <linearGradient id="missionGradient"><stop stopColor="#67e8f9" /><stop offset="1" stopColor="#a78bfa" /></linearGradient>
              <linearGradient id="healthGradient"><stop stopColor="#6ee7b7" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-6xl font-black tracking-tight text-slate-50">{formatPercent(score)}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Mission</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-300">Today's Mission</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-slate-50 sm:text-4xl">{focusText}</h1>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniMetric label="Today Score" value={formatPercent(score)} progress={score} />
          <MiniMetric label="Open loops" value={dashboard.counts.waiting} progress={Math.max(12, 100 - dashboard.counts.waiting * 4)} />
          <MiniMetric label="Time left" value={`${dashboard.overview.timeRemainingHours}h`} progress={Math.min(100, dashboard.overview.timeRemainingHours * 12)} />
          <MiniMetric label="Brain Health" value={formatPercent(health)} progress={health} />
        </div>
      </div>
    </div>
  </section>;
}

export function WeeklyMomentum({ trends = EMPTY_ARRAY }) {
  const merged = trends.length ? trends[0].data || EMPTY_ARRAY : EMPTY_ARRAY;
  const values = merged.map((item) => Number(item.value) || 0);
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${80 - (value / max) * 64}`).join(' ');
  const areaPoints = points ? `0,80 ${points} 100,80` : '';
  const total = trends.reduce((sum, series) => sum + (series.data || EMPTY_ARRAY).reduce((inner, item) => inner + (Number(item.value) || 0), 0), 0);

  return <ChartPanel eyebrow="Weekly momentum" title="Execution trend" className="bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_36%),rgba(2,6,23,0.82)]">
    {values.length ? <>
      <svg viewBox="0 0 100 86" preserveAspectRatio="none" className="h-56 w-full overflow-visible">
        <polygon points={areaPoints} fill="rgba(34,211,238,0.12)" />
        <polyline points={points} fill="none" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-4 flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-400">Tasks • Notes • Reviews</span>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-bold text-cyan-100">{total} total</span>
      </div>
    </> : <EmptyState>No trend data yet.</EmptyState>}
  </ChartPanel>;
}

export function FocusDonut({ data = EMPTY_ARRAY }) {
  const total = data.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
  let offset = 25;

  return <ChartPanel eyebrow="Focus distribution" title="Time allocation">
    {total ? <div className="grid gap-6 sm:grid-cols-[190px_1fr] sm:items-center">
      <div className="relative mx-auto h-48 w-48">
        <svg viewBox="0 0 42 42" className="h-48 w-48 -rotate-90">
          <circle cx="21" cy="21" r="15.915" fill="none" stroke="rgb(30 41 59)" strokeWidth="5" />
          {data.map((item) => {
            const value = ((Number(item.minutes) || 0) / total) * 100;
            const segment = <circle key={item.label} cx="21" cy="21" r="15.915" fill="none" stroke={item.color || '#67e8f9'} strokeWidth="5" strokeDasharray={`${value} ${100 - value}`} strokeDashoffset={offset} strokeLinecap="round" />;
            offset -= value;
            return segment;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-black text-slate-50">{Math.round(total / 60)}h</p>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">planned</p>
        </div>
      </div>
      <div className="space-y-3">
        {data.slice(0, 5).map((item) => {
          const value = ((Number(item.minutes) || 0) / total) * 100;
          return <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-200"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color || '#67e8f9' }} />{item.label}</span>
            <span className="text-sm font-black text-slate-50">{Math.round(value)}%</span>
          </div>;
        })}
      </div>
    </div> : <EmptyState>No schedule blocks to categorize.</EmptyState>}
  </ChartPanel>;
}

export function ProjectBubbleChart({ projects = EMPTY_ARRAY }) {
  const safeProjects = projects.slice(0, 5);
  const positions = [
    { x: 46, y: 48, r: 26 },
    { x: 69, y: 31, r: 18 },
    { x: 72, y: 70, r: 15 },
    { x: 29, y: 72, r: 13 },
    { x: 24, y: 33, r: 11 },
  ];

  return <ChartPanel eyebrow="Project health" title="Project Rings" className="bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_42%),rgba(2,6,23,0.82)]">
    {safeProjects.length ? <div className="relative h-72">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <line x1="46" y1="48" x2="69" y2="31" stroke="rgba(148,163,184,0.18)" />
        <line x1="46" y1="48" x2="72" y2="70" stroke="rgba(148,163,184,0.18)" />
        <line x1="46" y1="48" x2="29" y2="72" stroke="rgba(148,163,184,0.18)" />
        {safeProjects.map((project, index) => {
          const position = positions[index];
          const progress = clampPercent(project.progress);
          const radius = position.r * (0.72 + progress / 220);
          return <g key={project.id || project.name}>
            <circle cx={position.x} cy={position.y} r={radius} fill="rgba(8,47,73,0.72)" stroke="rgba(103,232,249,0.92)" strokeWidth="1" />
            <circle cx={position.x} cy={position.y} r={radius * 0.55} fill="rgba(34,211,238,0.13)" />
          </g>;
        })}
      </svg>
      {safeProjects.map((project, index) => {
        const position = positions[index];
        return <div key={project.id || project.name} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${position.x}%`, top: `${position.y}%` }}>
          <p className="max-w-24 truncate text-sm font-black text-slate-50">{project.name}</p>
          <p className="text-xs font-bold text-cyan-200">{formatPercent(project.progress)}</p>
        </div>;
      })}
    </div> : <EmptyState>No active project progress data yet.</EmptyState>}
  </ChartPanel>;
}

export function BrainRadar({ data = EMPTY_ARRAY, brainHealth }) {
  const size = 260;
  const center = size / 2;
  const radius = 82;
  const radarData = data.length ? data : (brainHealth?.stats || EMPTY_ARRAY).map((item) => ({ label: item.label, value: Math.min(100, Number(item.value) * 8) }));
  const points = radarData.map((item, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(radarData.length, 1)) * Math.PI * 2;
    const valueRadius = radius * (clampPercent(item.value) / 100);
    return {
      ...item,
      x: center + Math.cos(angle) * valueRadius,
      y: center + Math.sin(angle) * valueRadius,
      lx: center + Math.cos(angle) * (radius + 34),
      ly: center + Math.sin(angle) * (radius + 34),
    };
  });

  return <ChartPanel eyebrow="Brain Health" title="Brain Globe">
    {radarData.length ? <div className="grid gap-5 lg:grid-cols-[260px_1fr] lg:items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-64 w-64 max-w-full">
        {[0.34, 0.67, 1].map((level) => <polygon key={level} points={radarData.map((_, index) => {
          const angle = -Math.PI / 2 + (index / radarData.length) * Math.PI * 2;
          return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
        }).join(' ')} fill="none" stroke="rgb(51 65 85)" strokeWidth="1" />)}
        {points.map((point) => <line key={point.label} x1={center} y1={center} x2={point.lx} y2={point.ly} stroke="rgb(30 41 59)" />)}
        <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="rgba(34,211,238,0.20)" stroke="#67e8f9" strokeWidth="2" />
        {points.map((point) => <text key={point.label} x={point.lx} y={point.ly} textAnchor="middle" dominantBaseline="middle" className="fill-slate-300 text-[10px] font-black">{point.label}</text>)}
      </svg>
      <div className="grid grid-cols-2 gap-3">
        {(brainHealth?.stats || EMPTY_ARRAY).map((item) => <MiniMetric key={item.label} label={item.label} value={item.value} progress={Math.min(100, Number(item.value) * 8)} />)}
      </div>
    </div> : <EmptyState>No radar data yet.</EmptyState>}
  </ChartPanel>;
}

export function ProductivityPulse({ data = EMPTY_ARRAY }) {
  const max = Math.max(...data.map((item) => Number(item.value) || 0), 1);

  return <ChartPanel eyebrow="Productivity pulse" title="Activity heatmap" className="xl:col-span-2">
    {data.length ? <>
      <div className="grid grid-cols-7 gap-2 overflow-hidden sm:[grid-template-columns:repeat(14,minmax(0,1fr))]">
        {data.map((item, index) => {
          const value = Number(item.value) || 0;
          const opacity = value ? 0.24 + (value / max) * 0.76 : 0.08;
          return <div key={`${item.date}-${index}`} title={`${item.date}: ${item.value} activity`} className="aspect-square rounded-lg border border-cyan-300/10 bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.12)] transition-opacity" style={{ opacity }} />;
        })}
      </div>
      <div className="mt-4 flex justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"><span>14-day snapshot</span><span>More activity = brighter</span></div>
    </> : <EmptyState>No activity data yet.</EmptyState>}
  </ChartPanel>;
}

function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-sm font-medium text-slate-500">{children}</div>;
}
