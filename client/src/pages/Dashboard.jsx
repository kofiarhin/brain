import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';
import { List } from '../components/List';

const EMPTY_PLAN_MESSAGE = 'No saved day plan yet. Run your planning workflow to generate today\'s operating timeline.';

function getScheduleTitle(item) {
  if (typeof item === 'string') return item;
  return item?.title || item?.activity || item?.description || 'Untitled block';
}

function getScheduleDescription(item) {
  if (!item || typeof item === 'string') return '';
  const description = item.description && item.description !== getScheduleTitle(item) ? item.description : '';
  return description || item.activity || '';
}

function parseStartMinutes(time = '') {
  const match = String(time).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, hours, minutes] = match;
  return Number(hours) * 60 + Number(minutes);
}

function formatDate(date) {
  if (!date) return 'Latest saved plan';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(date));
}

function getTimelineState(schedule, currentMinutes) {
  const datedSchedule = schedule.map((item, index) => ({
    item,
    index,
    startMinutes: parseStartMinutes(item?.time)
  }));

  const currentIndex = datedSchedule.reduce((activeIndex, block, index) => {
    if (block.startMinutes === null || block.startMinutes > currentMinutes) return activeIndex;
    return index;
  }, -1);

  const nextIndex = datedSchedule.findIndex((block) => block.startMinutes !== null && block.startMinutes > currentMinutes);

  return datedSchedule.map((block, index) => {
    if (index === currentIndex) return { ...block, state: 'Now' };
    if (index === nextIndex) return { ...block, state: 'Next' };
    if (block.startMinutes !== null && block.startMinutes < currentMinutes) return { ...block, state: 'Done / passed' };
    return { ...block, state: 'Later' };
  });
}

export function Dashboard() {
  const { data: plan, isLoading } = useQuery({ queryKey: ['dayPlans', 'latest'], queryFn: api.dayPlans.latest, retry: false });
  const currentMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);
  const timeline = useMemo(() => getTimelineState(plan?.schedule || [], currentMinutes), [currentMinutes, plan?.schedule]);
  const activeBlock = timeline.find((block) => block.state === 'Now') || timeline.find((block) => block.state === 'Next');

  if (isLoading) return <p>Loading dashboard...</p>;

  if (!plan) {
    return <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Daily Timeline</p>
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>
      <Card title="No Operational Timeline">
        <p className="text-sm leading-relaxed text-slate-300">{EMPTY_PLAN_MESSAGE}</p>
      </Card>
    </div>;
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Daily Timeline</p>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">{formatDate(plan.date)} · Follow the next block, not another status summary.</p>
      </div>
      <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
        <span className="block text-xs uppercase tracking-[0.18em] text-cyan-300">Current move</span>
        <span className="font-semibold">{activeBlock ? getScheduleTitle(activeBlock.item) : 'No remaining scheduled blocks'}</span>
      </div>
    </div>

    <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Card title="Operational Timeline">
        {timeline.length ? <ol className="space-y-3">
          {timeline.map(({ item, index, state }) => {
            const isActive = state === 'Now';
            const isNext = state === 'Next';
            return <li className={`rounded-2xl border p-4 ${isActive ? 'border-cyan-300 bg-cyan-400/10' : isNext ? 'border-amber-300/70 bg-amber-300/10' : 'border-slate-800 bg-slate-950/40'}`} key={`${item?.time || 'block'}-${index}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item?.time || 'Unscheduled'}</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-100">{getScheduleTitle(item)}</h2>
                  {getScheduleDescription(item) && <p className="mt-2 text-sm leading-relaxed text-slate-400">{getScheduleDescription(item)}</p>}
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${isActive ? 'bg-cyan-300 text-slate-950' : isNext ? 'bg-amber-300 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{state}</span>
              </div>
            </li>;
          })}
        </ol> : <p className="text-sm text-slate-500">No schedule blocks saved yet.</p>}
      </Card>

      <div className="space-y-4">
        <Card title="Today's Focus">
          <p className="text-sm leading-relaxed text-slate-300">{plan.focus || 'No focus saved yet.'}</p>
        </Card>
        <Card title="Priority Guardrails">
          <List items={plan.priorities?.slice(0, 3)} />
        </Card>
        <Card title="Win Condition">
          <List items={plan.winCondition} />
        </Card>
      </div>
    </section>
  </div>;
}
