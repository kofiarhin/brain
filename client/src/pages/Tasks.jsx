import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';
import { addLondonDays, getLondonDateKey, nextWeekendLondonDate } from '../utils/londonDate';

const groups = [['must', 'Must Do'], ['should', 'Should Do'], ['nice', 'Nice To Have']];
const hiddenStatuses = new Set(['complete', 'completed', 'done', 'dismissed', 'archived', 'converted']);
const completedStatuses = new Set(['complete', 'completed', 'done']);
const dismissalReasons = [
  ['task_no_longer_needed', 'Task no longer needed'],
  ['project_abandoned', 'Project abandoned'],
  ['duplicate', 'Duplicate'],
  ['generated_incorrectly', 'Generated incorrectly'],
  ['circumstances_changed', 'Circumstances changed'],
  ['external_blocker', 'External blocker'],
  ['replaced_by_another_task', 'Replaced by another task'],
  ['other', 'Other']
];
const categories = [
  ['projects', 'Projects'],
  ['family', 'Family'],
  ['personal', 'Personal'],
  ['admin', 'Admin'],
  ['general', 'General']
];
const tabs = [['all', 'All'], ['agent', 'Agent'], ...categories, ['completed', 'Completed']];

function normalizeCategory(category) {
  const normalized = String(category || '').toLowerCase();
  return categories.some(([value]) => value === normalized) ? normalized : 'general';
}

function normalizePriority(priority) {
  const normalized = String(priority || '').toLowerCase();
  if (normalized === 'high') return 'must';
  if (normalized === 'medium') return 'should';
  if (normalized === 'low') return 'nice';
  return groups.some(([value]) => value === normalized) ? normalized : 'should';
}

function categoryLabel(category) {
  return categories.find(([value]) => value === category)?.[1] || 'General';
}

function priorityLabel(priority) {
  const normalized = normalizePriority(priority);
  return groups.find(([value]) => value === normalized)?.[1] || 'Should Do';
}

function statusLabel(status) {
  const normalized = String(status || 'open').toLowerCase();
  if (['complete', 'completed', 'done'].includes(normalized)) return 'Done';
  if (normalized === 'rescheduled') return 'Rescheduled';
  if (normalized === 'dismissed') return 'Dismissed';
  if (normalized === 'converted') return 'Converted';
  if (normalized === 'archived') return 'Archived';
  return 'Open';
}

function badgeClass(tone = 'default') {
  const tones = {
    default: 'border-slate-700 bg-slate-900 text-slate-300',
    open: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    done: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    archived: 'border-slate-600 bg-slate-800 text-slate-400',
    category: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-100',
    agent: 'border-amber-400/30 bg-amber-400/10 text-amber-100'
  };
  return `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.default}`;
}

function isActiveTask(task) {
  return !hiddenStatuses.has(String(task.status || '').toLowerCase());
}

function taskScheduledLondonDate(task) {
  return task.scheduledLondonDate
    || (task.scheduledFor ? getLondonDateKey(task.scheduledFor) : '')
    || task.dueLondonDate
    || (task.dueDate ? getLondonDateKey(task.dueDate) : '');
}

function isVisibleToday(task, todayLondonDate) {
  const scheduledDate = taskScheduledLondonDate(task);
  return !scheduledDate || scheduledDate <= todayLondonDate;
}

function taskMatchesTab(task, tab) {
  if (tab === 'all') return true;
  if (tab === 'agent') return task.agentReady === true;
  return normalizeCategory(task.category) === tab;
}

function tasksForTab(tab, items) {
  return items.filter((task) => taskMatchesTab(task, tab));
}

function buildTabCounts(activeItems, completedItems) {
  return {
    all: activeItems.length,
    agent: activeItems.filter((task) => task.agentReady === true).length,
    completed: completedItems.length,
    ...Object.fromEntries(
      categories.map(([category]) => [
        category,
        activeItems.filter((task) => normalizeCategory(task.category) === category).length
      ])
    )
  };
}

function wasCompletedToday(task, todayLondonDate = getLondonDateKey()) {
  return completedStatuses.has(String(task.status || '').toLowerCase()) && getLondonDateKey(task.completedAt) === todayLondonDate;
}

function previewText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function TaskSummary({ task }) {
  const taskCategory = normalizeCategory(task.category);
  const status = statusLabel(task.status);
  const scheduledDate = taskScheduledLondonDate(task);
  return <div className="min-w-0 flex-1">
    <h2 className="break-words text-base font-semibold leading-6 text-slate-50 sm:text-lg">{task.title}</h2>
    <div className="mt-2 flex flex-wrap gap-2">
      <span className={badgeClass(status === 'Done' ? 'done' : status === 'Archived' ? 'archived' : 'open')}>{status}</span>
      <span className={badgeClass()}>{priorityLabel(task.priority)}</span>
      <span className={badgeClass('category')}>{categoryLabel(taskCategory)}</span>
      {scheduledDate ? <span className={badgeClass()}>Scheduled {scheduledDate}</span> : null}
      {task.agentReady === true ? <span className={badgeClass('agent')}>Agent-ready</span> : null}
    </div>
    {previewText(task.expectedDeliverable) ? <p className="mt-3 truncate text-sm text-slate-300">{previewText(task.expectedDeliverable)}</p> : null}
  </div>;
}

function CompletedTaskCard({ task }) {
  return <li>
    <a href={`/tasks/${task._id}`} className="block rounded-lg border border-slate-700/80 bg-slate-800/80 p-4 shadow-sm shadow-slate-950/20 transition hover:border-blue-500/50 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950">
      <TaskSummary task={task} />
    </a>
  </li>;
}

function TaskCard({ task, onComplete, onReschedule, onDismiss, onArchive, onConvert, isCompleting = false, isRescheduling = false, isResolving = false }) {
  const [copyStatus, setCopyStatus] = useState('idle');

  const copyTaskTitle = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(task.title);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1600);
    } catch (error) {
      setCopyStatus('failed');
      window.setTimeout(() => setCopyStatus('idle'), 1600);
      console.warn('Unable to copy task title', error);
    }
  };

  const completeTask = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onComplete(task._id);
  };

  const chooseOutcome = async (event) => {
    const action = event.target.value;
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    event.target.value = '';

    if (action === 'complete') return onComplete(task._id);
    if (action === 'archive') return onArchive(task._id);
    if (action === 'dismiss') {
      const reasonInput = window.prompt(`Dismiss reason:\n${dismissalReasons.map(([, label], index) => `${index + 1}. ${label}`).join('\n')}`, '1');
      if (!reasonInput) return;
      const selectedReason = dismissalReasons[Number(reasonInput) - 1]?.[0]
        || dismissalReasons.find(([value, label]) => value === reasonInput || label.toLowerCase() === reasonInput.toLowerCase())?.[0];
      if (!selectedReason) return;
      const note = window.prompt('Optional dismissal note', '') || '';
      const markProjectInactive = selectedReason === 'project_abandoned' && task.projectId
        ? window.confirm('Also mark the linked project inactive? Cancel dismisses this task only.')
        : false;
      return onDismiss(task._id, { reason: selectedReason, note, markProjectInactive });
    }
    if (action === 'convert') {
      const replacementTaskId = window.prompt('Replacement task ID');
      if (!replacementTaskId) return;
      return onConvert(task._id, { replacementTaskId, reason: 'replaced_by_another_task' });
    }
  };

  const postponeTask = async (event) => {
    const option = event.target.value;
    if (!option) return;
    event.preventDefault();
    event.stopPropagation();

    const today = getLondonDateKey();
    const targetDate = {
      tomorrow: addLondonDays(today, 1),
      weekend: nextWeekendLondonDate(today),
      nextWeek: addLondonDays(today, 7),
    }[option] || window.prompt('Pick date (YYYY-MM-DD)', addLondonDays(today, 1));

    event.target.value = '';
    if (!targetDate) return;
    onReschedule(task._id, { targetDate, reason: option });
  };

  return <li className="relative rounded-lg border border-slate-700/80 bg-slate-800/80 shadow-sm shadow-slate-950/20 transition hover:border-blue-500/50 hover:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-950">
    <a href={`/tasks/${task._id}`} aria-label={task.title} className="absolute inset-0 z-0 rounded-lg focus:outline-none" />
    <div className="relative z-10 flex flex-col gap-4 p-4 pointer-events-none sm:flex-row sm:items-start sm:justify-between">
      <TaskSummary task={task} />
      <div className="pointer-events-auto flex w-full items-center gap-2 sm:w-auto">
        <button
          type="button"
          aria-label="Copy task title"
          title={copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy task title'}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-slate-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${copyStatus === 'copied' ? 'border-blue-400/70 bg-blue-500/15' : 'border-slate-600 hover:border-blue-500/60 hover:bg-blue-500/10'}`}
          onClick={copyTaskTitle}
        >
          {copyStatus === 'copied' ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>}
        </button>
        <select
          aria-label={`Postpone ${task.title}`}
          className="min-h-10 rounded-full border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          defaultValue=""
          disabled={isRescheduling}
          onChange={postponeTask}
        >
          <option value="" disabled>{isRescheduling ? 'Moving...' : 'Postpone'}</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="weekend">This Weekend</option>
          <option value="nextWeek">Next Week</option>
          <option value="pick">Pick Date</option>
        </select>
        <select
          aria-label={`Resolve ${task.title}`}
          className="min-h-10 rounded-full border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          defaultValue=""
          disabled={isResolving || isCompleting}
          onChange={chooseOutcome}
        >
          <option value="" disabled>{isResolving ? 'Resolving...' : 'Outcome'}</option>
          <option value="complete">Complete</option>
          <option value="dismiss">Dismiss / No longer relevant</option>
          <option value="archive">Archive</option>
          <option value="convert">Convert / Replace</option>
        </select>
        <button
          type="button"
          className="w-full rounded-full border border-emerald-500/60 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          disabled={isCompleting}
          onClick={completeTask}
        >
          {isCompleting ? 'Completing...' : 'Complete'}
        </button>
      </div>
    </div>
  </li>;
}

export function Tasks() {
  const [selectedTab, setSelectedTab] = useState('all');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('should');
  const [agentReady, setAgentReady] = useState(false);
  const tasks = useResource('tasks');
  const items = tasks.data || [];
  const todayLondonDate = getLondonDateKey();
  const activeItems = items.filter((task) => isActiveTask(task) && isVisibleToday(task, todayLondonDate));
  const completedItems = items.filter((task) => wasCompletedToday(task, todayLondonDate));
  const filteredItems = tasksForTab(selectedTab, activeItems);
  const tabCounts = buildTabCounts(activeItems, completedItems);
  const completingTaskId = tasks.complete.isPending ? tasks.complete.variables : null;
  const reschedulingTaskId = tasks.reschedule.isPending ? tasks.reschedule.variables?.id : null;
  const resolvingTaskId = tasks.dismiss.isPending ? tasks.dismiss.variables?.id
    : tasks.archive.isPending ? tasks.archive.variables
      : tasks.convert.isPending ? tasks.convert.variables?.id
        : null;

  const save = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    await tasks.create.mutateAsync({ title: title.trim(), priority, agentReady });
    setTitle('');
    setPriority('should');
    setAgentReady(false);
  };

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold sm:text-3xl">Tasks</h1>
    <Card title="Create Task">
      <form onSubmit={save} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_auto_auto] lg:items-end">
        <label className="text-sm text-slate-300">
          <span className="mb-1 block text-xs uppercase text-slate-400">Title</span>
          <input aria-label="Task title" className="w-full rounded border border-slate-700 bg-slate-950 p-3" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="text-sm text-slate-300">
          <span className="mb-1 block text-xs uppercase text-slate-400">Priority</span>
          <select aria-label="Task priority" className="w-full rounded border border-slate-700 bg-slate-950 p-3" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {groups.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-200">
          <input aria-label="Assignable to Codex" type="checkbox" checked={agentReady} onChange={(e) => setAgentReady(e.target.checked)} />
          Assignable to Codex
        </label>
        <button className="rounded-lg bg-blue-600 px-4 py-3 font-medium">Save task</button>
      </form>
    </Card>
    <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-2">
      {tabs.map(([value, label]) => {
        const isSelected = selectedTab === value;
        const tabCount = tabCounts[value] ?? 0;
        return <button
          key={value}
          type="button"
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${isSelected ? 'bg-blue-600 text-white shadow shadow-blue-950/40' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          onClick={() => setSelectedTab(value)}
        >
          <span>{label}</span>
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-950 text-slate-400'}`}>{tabCount}</span>
        </button>;
      })}
    </div>
    {selectedTab === 'agent' ? <p className="text-sm text-slate-400">Tasks marked as assignable to Codex.</p> : null}
    {selectedTab === 'completed' ? categories.map(([category, groupTitle]) => {
      const groupItems = completedItems.filter((task) => normalizeCategory(task.category) === category);
      if (groupItems.length === 0) return null;
      return <Card key={category} title={groupTitle}><ul className="space-y-3">{groupItems.map((task) => <CompletedTaskCard key={task._id} task={task} />)}</ul></Card>;
    }) : groups.map(([priority, groupTitle]) => {
      const groupItems = filteredItems.filter((task) => normalizePriority(task.priority) === priority);
      if (groupItems.length === 0) return null;
      return <Card key={priority} title={groupTitle}><ul className="space-y-3">{groupItems.map((task) => <TaskCard key={task._id} task={task} onComplete={tasks.complete.mutate} onReschedule={(id, payload) => tasks.reschedule.mutate({ id, payload })} onDismiss={(id, payload) => tasks.dismiss.mutate({ id, payload })} onArchive={tasks.archive.mutate} onConvert={(id, payload) => tasks.convert.mutate({ id, payload })} isCompleting={completingTaskId === task._id} isRescheduling={reschedulingTaskId === task._id} isResolving={resolvingTaskId === task._id} />)}</ul></Card>;
    })}
    {selectedTab === 'completed' && completedItems.length === 0 ? <p className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">No tasks completed today.</p> : null}
    {selectedTab !== 'completed' && filteredItems.length === 0 ? <p className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">No open tasks in this tab.</p> : null}
  </div>;
}
