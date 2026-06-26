import { Card } from '../Card';

function MetricInline({ label, value }) {
  return <div className="rounded-xl bg-slate-950/70 p-3">
    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-50">{value}</p>
  </div>;
}

export function ScoreCard({ score, label }) {
  return <Card title="Today Score">
    <div className="flex items-end justify-between gap-4">
      <p className="text-5xl font-black text-slate-50">{score}%</p>
      <p className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">{label}</p>
    </div>
    <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-700" style={{ width: `${score}%` }} />
    </div>
  </Card>;
}

export function OpenLoopsCard({ kpis }) {
  return <Card title="Open Loops">
    <div className="grid grid-cols-2 gap-3 text-sm">
      <MetricInline label="Tasks" value={kpis.openTasks} />
      <MetricInline label="Task Outputs" value={kpis.openTaskOutputs} />
      <MetricInline label="Projects" value={kpis.activeProjects} />
      <MetricInline label="Waiting" value={kpis.waiting} />
      <MetricInline label="Reviews" value={kpis.reviewsDue} />
    </div>
  </Card>;
}

export function TimeRemainingCard({ timeRemaining }) {
  return <Card title="Time Remaining">
    <p className="text-4xl font-black text-slate-50">{timeRemaining.hours.toFixed(1)}h</p>
    <p className="mt-1 text-sm text-slate-400">{timeRemaining.blocks} planned block{timeRemaining.blocks === 1 ? '' : 's'} left today</p>
    <div className="mt-4 space-y-2">
      {timeRemaining.categories.length ? timeRemaining.categories.slice(0, 4).map((item) => <div className="flex items-center justify-between text-sm" key={item.label}>
        <span className="text-slate-400">{item.label}</span>
        <span className="font-semibold text-slate-100">{(item.minutes / 60).toFixed(1)}h</span>
      </div>) : <p className="text-sm text-slate-500">No reliable schedule time data.</p>}
    </div>
  </Card>;
}

export function Heatmap({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <Card title="Productivity Heatmap">
    <div className="grid grid-cols-7 gap-2 sm:grid-cols-14">
      {data.map((item, index) => {
        const opacity = item.value ? 0.25 + (item.value / max) * 0.75 : 0.08;
        return <div key={`${item.date}-${index}`} title={`${item.date}: ${item.value} activity`} className="aspect-square rounded-md border border-slate-800 bg-cyan-400" style={{ opacity }} />;
      })}
    </div>
    <div className="mt-3 flex justify-between text-xs text-slate-500"><span>14-day current snapshot</span><span>More activity = brighter</span></div>
  </Card>;
}

export function StackedFocusBar({ data }) {
  const total = data.reduce((sum, item) => sum + item.minutes, 0);
  return <Card title="Focus Allocation">
    {total ? <>
      <div className="flex h-5 overflow-hidden rounded-full bg-slate-800">
        {data.map((item) => <div key={item.label} className="transition-all duration-700" style={{ width: `${(item.minutes / total) * 100}%`, backgroundColor: item.color }} title={`${item.label}: ${(item.minutes / 60).toFixed(1)}h`} />)}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {data.map((item) => <div className="flex items-center justify-between gap-3 text-sm" key={item.label}>
          <span className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
          <span className="font-semibold text-slate-100">{(item.minutes / 60).toFixed(1)}h · {Math.round((item.minutes / total) * 100)}%</span>
        </div>)}
      </div>
    </> : <p className="text-sm text-slate-500">No schedule blocks to categorize.</p>}
  </Card>;
}

function ProgressRing({ label, value }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
    <svg viewBox="0 0 88 88" className="mx-auto h-24 w-24 -rotate-90">
      <circle cx="44" cy="44" r={radius} fill="none" stroke="rgb(30 41 59)" strokeWidth="8" />
      <circle cx="44" cy="44" r={radius} fill="none" stroke="url(#ringGradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      <defs><linearGradient id="ringGradient"><stop stopColor="#22d3ee" /><stop offset="1" stopColor="#a78bfa" /></linearGradient></defs>
    </svg>
    <p className="mt-2 font-semibold text-slate-100">{label}</p>
    <p className="text-sm text-cyan-300">{value}%</p>
  </div>;
}

export function ProjectRings({ projects }) {
  return <Card title="Project Rings">
    {projects.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{projects.map((project) => <ProgressRing key={project.id || project.name} label={project.name} value={project.progress} />)}</div> : <p className="text-sm text-slate-500">No active project progress data yet.</p>}
  </Card>;
}

function Sparkline({ series }) {
  const values = series.data.map((item) => item.value);
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${40 - (value / max) * 34}`).join(' ');
  const total = values.reduce((sum, value) => sum + value, 0);
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
    <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-100">{series.label}</p><span className="text-sm text-cyan-300">{total}</span></div>
    <svg viewBox="0 0 100 44" className="mt-3 h-16 w-full overflow-visible">
      <polyline points={points} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>;
}

export function TrendSparklines({ trends }) {
  return <Card title="Trend Sparklines"><div className="grid gap-3 md:grid-cols-3">{trends.map((series) => <Sparkline key={series.label} series={series} />)}</div></Card>;
}

export function RadarChart({ data }) {
  const size = 220;
  const center = size / 2;
  const radius = 72;
  const points = data.map((item, index) => {
    const angle = -Math.PI / 2 + (index / data.length) * Math.PI * 2;
    const valueRadius = radius * (item.value / 100);
    return { ...item, x: center + Math.cos(angle) * valueRadius, y: center + Math.sin(angle) * valueRadius, lx: center + Math.cos(angle) * (radius + 28), ly: center + Math.sin(angle) * (radius + 28) };
  });
  return <Card title="Life Radar">
    <div className="flex flex-col items-center gap-4 md:flex-row">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-64 w-64 max-w-full">
        {[0.33, 0.66, 1].map((level) => <polygon key={level} points={data.map((_, index) => {
          const angle = -Math.PI / 2 + (index / data.length) * Math.PI * 2;
          return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
        }).join(' ')} fill="none" stroke="rgb(51 65 85)" strokeWidth="1" />)}
        {points.map((point) => <line key={point.label} x1={center} y1={center} x2={point.lx} y2={point.ly} stroke="rgb(30 41 59)" />)}
        <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="rgba(34,211,238,0.22)" stroke="#22d3ee" strokeWidth="2" />
        {points.map((point) => <text key={point.label} x={point.lx} y={point.ly} textAnchor="middle" dominantBaseline="middle" className="fill-slate-300 text-[10px] font-semibold">{point.label}</text>)}
      </svg>
      <div className="grid flex-1 gap-2">{data.map((item) => <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2 text-sm" key={item.label}><span className="text-slate-300">{item.label}</span><span className="font-semibold text-slate-50">{Math.round(item.value)}%</span></div>)}</div>
    </div>
  </Card>;
}

export function BrainHealth({ brainHealth }) {
  return <Card title="Brain Health">
    <div className="mb-4"><p className="text-4xl font-black text-slate-50">{brainHealth.score}%</p><p className="text-sm text-slate-400">maintenance health</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{brainHealth.stats.map((item) => <MetricInline key={item.label} label={item.label} value={item.value} />)}</div>
  </Card>;
}

export function InsightsList({ insights }) {
  return <Card title="Insights"><ul className="space-y-3">{insights.map((insight) => <li className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm leading-relaxed text-slate-300" key={insight}>{insight}</li>)}</ul></Card>;
}
