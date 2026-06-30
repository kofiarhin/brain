import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';
import { List } from '../components/List';

export function getLondonDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDaysToDateKey(dateKey, amount) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return getLondonDateKey(new Date(Date.UTC(year, month - 1, day + amount, 12)));
}

export function formatDateHeading(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatScheduleItem(item) {
  if (typeof item === 'string') return item;
  const label = item.activity || item.title || item.description || '';
  return [item.time, label].filter(Boolean).join(' - ');
}

function formatMotivationalPost(post) {
  if (!post) return 'None';
  if (typeof post === 'string') return post;
  const parts = [post.message, post.davidGogginsQuote, post.stoicQuote].filter(Boolean);
  return parts.length ? parts.join('\n\n') : 'None';
}

function formatDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function sessionLabel(value) {
  if (value === 'restart') return 'Restarted';
  if (value === 'start') return 'Started';
  return 'Legacy plan';
}

function PlanSections({ plan }) {
  const schedule = plan?.schedule?.map(formatScheduleItem) || [];

  return <>
    <Card title="Plan Window">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-sm text-slate-500">Start</dt><dd className="font-medium">{formatDateTime(plan?.startTime || plan?.date)}</dd></div>
        <div><dt className="text-sm text-slate-500">End</dt><dd className="font-medium">{formatDateTime(plan?.endTime)}</dd></div>
        <div><dt className="text-sm text-slate-500">Status</dt><dd className="font-medium capitalize">{plan?.status || 'legacy'}</dd></div>
        <div><dt className="text-sm text-slate-500">Session</dt><dd className="font-medium">{sessionLabel(plan?.sessionType)}</dd></div>
      </dl>
    </Card>
    <Card title="Focus"><p>{plan?.focus || 'No saved plan yet.'}</p></Card>
    <Card title="Top 3 Priorities"><List items={plan?.priorities} /></Card>
    <Card title="Schedule"><List items={schedule} /></Card>
    <Card title="Must Do"><List items={plan?.mustDo} /></Card>
    <Card title="Should Do"><List items={plan?.shouldDo} /></Card>
    <Card title="Nice To Have"><List items={plan?.niceToHave} /></Card>
    <Card title="Things You May Be Forgetting"><List items={plan?.forgotten} /></Card>
    <Card title="Suggested Task Outcomes"><List items={plan?.deliverables} /></Card>
    <Card title="Win Condition"><List items={plan?.winCondition} /></Card>
    <Card title="Insight of the Day"><p>{plan?.insight || 'None'}</p></Card>
    <Card title="Motivational Post"><p className="whitespace-pre-wrap">{formatMotivationalPost(plan?.motivationalPost)}</p></Card>
    <Card title="Unclear Items"><List items={plan?.unclearItems?.length ? plan.unclearItems : ['None']} /></Card>
  </>;
}

export function DayPlan() {
  const [viewedDate, setViewedDate] = useState(() => getLondonDateKey());
  const todayKey = getLondonDateKey();
  const isToday = viewedDate === todayKey;
  const { data, error, isLoading } = useQuery({
    queryKey: ['dayPlans', 'byDate', viewedDate],
    queryFn: () => api.dayPlans.byDate(viewedDate),
    retry: false,
  });

  return <div className="space-y-6">
    <h1 className="text-3xl font-bold">Day Plan</h1>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
      <button
        className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setViewedDate((value) => addDaysToDateKey(value, -1))}
        type="button"
      >
        &larr; Previous Day
      </button>
      <p className="text-center text-lg font-semibold">{formatDateHeading(viewedDate)}</p>
      <button
        className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isToday}
        onClick={() => setViewedDate(todayKey)}
        type="button"
      >
        Today
      </button>
    </div>
    {isLoading && <p className="text-sm text-slate-400">Loading day plan...</p>}
    {data?.plan && <PlanSections plan={data.plan} />}
    {!isLoading && data?.plan === null && <Card><p>No plan was generated for this day.</p></Card>}
    {error && <Card><p>{error.message}</p></Card>}
  </div>;
}
