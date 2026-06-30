import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';
import { List } from '../components/List';
import { TaskActionsDropdown } from '../components/TaskActionsDropdown';

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

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function taskTitle(task) {
  return normalizeText(task?.title);
}

function timelineTitle(item) {
  if (typeof item === 'string') return item;
  return item?.title || item?.activity || item?.description || '';
}

function timelineTaskId(item) {
  if (!item || typeof item !== 'object') return '';
  return item.taskId || item.task || item._id || '';
}

function findTimelineTask(item, tasks) {
  const itemTaskId = String(timelineTaskId(item) || '');
  if (itemTaskId) {
    const byId = tasks.find((task) => String(task._id) === itemTaskId);
    if (byId) return byId;
  }

  const title = normalizeText(timelineTitle(item));
  if (!title) return null;
  return tasks.find((task) => taskTitle(task) === title) || null;
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

function TaskStatusBadge({ task }) {
  const status = String(task?.status || 'open').toLowerCase();
  const isDone = ['complete', 'completed', 'done'].includes(status);
  return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${isDone ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-950 text-slate-300'}`}>
    {isDone ? 'Done' : status === 'rescheduled' ? 'Rescheduled' : 'Open'}
  </span>;
}

function PlanTimeline({ plan, tasks, taskActions, openMenuId, setOpenMenuId }) {
  const schedule = plan?.schedule || [];
  const usedTaskIds = new Set();
  const planTitles = [
    ...(plan?.mustDo || []),
    ...(plan?.shouldDo || []),
    ...(plan?.niceToHave || []),
    ...(plan?.deliverables || []),
  ];
  const entries = schedule.map((item, index) => {
    const task = findTimelineTask(item, tasks);
    if (task?._id) usedTaskIds.add(String(task._id));
    return { key: `schedule-${index}`, item, task };
  });

  planTitles.forEach((item, index) => {
    const task = findTimelineTask(item, tasks);
    if (!task?._id || usedTaskIds.has(String(task._id))) return;
    usedTaskIds.add(String(task._id));
    entries.push({ key: `task-${task._id || index}`, item, task });
  });

  return <Card title="Plan Timeline">
    {entries.length ? <ol className="space-y-3">
      {entries.map(({ key, item, task }) => {
        const label = timelineTitle(item);
        const time = typeof item === 'object' ? item.time : '';
        const description = typeof item === 'object' ? item.description : '';
        return <li key={key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {time ? <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{time}</p> : null}
              <p className="break-words font-semibold text-slate-100">{label || formatScheduleItem(item)}</p>
              {description && description !== label ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
              {task ? <div className="mt-2 flex flex-wrap items-center gap-2">
                <TaskStatusBadge task={task} />
                {task.agentReady === true ? <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-100">Agent-ready</span> : null}
              </div> : null}
            </div>
            {task ? <TaskActionsDropdown
              task={task}
              open={openMenuId === task._id}
              onOpenChange={(isOpen) => setOpenMenuId(isOpen ? task._id : null)}
              {...taskActions}
            /> : null}
          </div>
        </li>;
      })}
    </ol> : <p className="text-sm text-slate-400">No timeline items saved for this plan.</p>}
  </Card>;
}

function PlanSections({ plan, tasks, taskActions, openMenuId, setOpenMenuId }) {

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
    <PlanTimeline plan={plan} tasks={tasks} taskActions={taskActions} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />
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
  const [openMenuId, setOpenMenuId] = useState(null);
  const queryClient = useQueryClient();
  const todayKey = getLondonDateKey();
  const isToday = viewedDate === todayKey;
  const { data, error, isLoading } = useQuery({
    queryKey: ['dayPlans', 'byDate', viewedDate],
    queryFn: () => api.dayPlans.byDate(viewedDate),
    retry: false,
  });
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: api.tasks.list });
  const refreshTimeline = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['dayPlans'] });
  };
  const complete = useMutation({ mutationFn: api.tasks.complete, onSuccess: refreshTimeline });
  const update = useMutation({ mutationFn: ({ id, payload }) => api.tasks.update(id, payload), onSuccess: refreshTimeline });
  const archive = useMutation({ mutationFn: api.tasks.archive, onSuccess: refreshTimeline });
  const dismiss = useMutation({ mutationFn: ({ id, payload }) => api.tasks.dismiss(id, payload), onSuccess: refreshTimeline });
  const convert = useMutation({ mutationFn: ({ id, payload }) => api.tasks.convert(id, payload), onSuccess: refreshTimeline });
  const reschedule = useMutation({ mutationFn: ({ id, payload }) => api.tasks.reschedule(id, payload), onSuccess: refreshTimeline });
  const taskActions = {
    onComplete: (id) => complete.mutateAsync(id),
    onUpdate: (id, payload) => update.mutateAsync({ id, payload }),
    onArchive: (id) => archive.mutateAsync(id),
    onDismiss: (id, payload) => dismiss.mutateAsync({ id, payload }),
    onConvert: (id, payload) => convert.mutateAsync({ id, payload }),
    onReschedule: (id, payload) => reschedule.mutateAsync({ id, payload }),
    isCompleting: complete.isPending,
    isUpdating: update.isPending,
    isResolving: archive.isPending || dismiss.isPending || convert.isPending,
    isRescheduling: reschedule.isPending,
  };

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
    {data?.plan && <PlanSections plan={data.plan} tasks={Array.isArray(tasksQuery.data) ? tasksQuery.data : []} taskActions={taskActions} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />}
    {!isLoading && data?.plan === null && <Card><p>No plan was generated for this day.</p></Card>}
    {error && <Card><p>{error.message}</p></Card>}
  </div>;
}
