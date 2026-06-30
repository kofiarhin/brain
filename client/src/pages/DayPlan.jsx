import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';
import { List } from '../components/List';

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

function PlanSections({ plan, variant = 'current' }) {
  const schedule = plan?.schedule?.map(formatScheduleItem) || [];
  const isPrevious = variant === 'previous';

  return <>
    <Card title={isPrevious ? 'Previous Plan Window' : 'Active Plan Window'}>
      {isPrevious && <p className="mb-3 text-sm font-medium text-amber-300">Historical plan, not today&apos;s active plan.</p>}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-sm text-slate-500">Start</dt><dd className="font-medium">{formatDateTime(plan?.startTime || plan?.date)}</dd></div>
        <div><dt className="text-sm text-slate-500">End</dt><dd className="font-medium">{formatDateTime(plan?.endTime)}</dd></div>
        <div><dt className="text-sm text-slate-500">Status</dt><dd className="font-medium capitalize">{plan?.status || 'legacy'}</dd></div>
        <div><dt className="text-sm text-slate-500">Session</dt><dd className="font-medium">{sessionLabel(plan?.sessionType)}</dd></div>
      </dl>
    </Card>
    <Card title={isPrevious ? 'Previous Focus' : 'Today Focus'}><p>{plan?.focus || 'No saved plan yet.'}</p></Card>
    <Card title="Top 3 Priorities"><List items={plan?.priorities} /></Card>
    <Card title="Day Plan"><List items={schedule} /></Card>
    <Card title="Must Do"><List items={plan?.mustDo} /></Card>
    <Card title="Should Do"><List items={plan?.shouldDo} /></Card>
    <Card title="Nice To Have"><List items={plan?.niceToHave} /></Card>
    <Card title="Things You May Be Forgetting"><List items={plan?.forgotten} /></Card>
    <Card title="Suggested Deliverables"><List items={plan?.deliverables} /></Card>
    <Card title="Win Condition"><List items={plan?.winCondition} /></Card>
    <Card title="Insight of the Day"><p>{plan?.insight || 'None'}</p></Card>
    <Card title="Motivational Post"><p className="whitespace-pre-wrap">{formatMotivationalPost(plan?.motivationalPost)}</p></Card>
    <Card title="Unclear Items"><List items={plan?.unclearItems?.length ? plan.unclearItems : ['None']} /></Card>
  </>;
}

function PreviousPlans({ enabled }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['dayPlans', 'previous', page],
    queryFn: () => api.dayPlans.previous({ page, limit: 1 }),
    enabled,
    retry: false,
    keepPreviousData: true,
  });
  const plan = data?.items?.[0];

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-bold">Previous Plans</h2>
      <div className="flex items-center gap-2">
        <button
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          type="button"
        >
          Previous
        </button>
        <span className="text-sm text-slate-400">Page {data?.page || page}</span>
        <button
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!data?.hasNextPage}
          onClick={() => setPage((value) => value + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
    {isLoading && <p className="text-sm text-slate-400">Loading previous plans...</p>}
    {!isLoading && !plan && <Card><p>No previous plans found.</p></Card>}
    {plan && <PlanSections plan={plan} variant="previous" />}
  </section>;
}

export function DayPlan() {
  const { data: plan, error, isLoading } = useQuery({ queryKey: ['dayPlans', 'latest'], queryFn: api.dayPlans.latest, retry: false });
  const todayMissing = error?.status === 404;

  return <div className="space-y-6"><h1 className="text-3xl font-bold">Day Plan</h1>
    {isLoading && <p className="text-sm text-slate-400">Loading day plan...</p>}
    {plan && <PlanSections plan={plan} />}
    {todayMissing && <>
      <Card><p>No plan has been generated for today yet.</p></Card>
      <PreviousPlans enabled />
    </>}
    {error && !todayMissing && <Card><p>{error.message}</p></Card>}
  </div>;
}
