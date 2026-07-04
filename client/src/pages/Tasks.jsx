import { useEffect, useMemo, useRef, useState } from 'react';
import { useResource } from '../hooks/useResource';
import { addLondonDays, getLondonDateKey, nextWeekendLondonDate } from '../utils/londonDate';

const views = [
  ['inbox', 'Inbox'],
  ['today', 'Today'],
  ['upcoming', 'Upcoming'],
  ['waiting', 'Waiting'],
  ['projects', 'Projects'],
  ['delegated', 'Delegated'],
  ['completed', 'Completed'],
];

const priorityOptions = [
  ['critical', 'Critical'],
  ['high', 'High'],
  ['medium', 'Medium'],
  ['low', 'Low'],
  ['someday', 'Someday'],
];

const priorityLegacyMap = {
  critical: 'must',
  high: 'high',
  medium: 'medium',
  low: 'low',
  someday: 'nice',
};

const categoryOptions = [
  ['projects', 'Projects'],
  ['family', 'Family'],
  ['personal', 'Personal'],
  ['admin', 'Admin'],
  ['general', 'General'],
];

const closedStatuses = new Set(['complete', 'completed', 'done', 'closed', 'archived', 'converted', 'dismissed']);
const completedStatuses = new Set(['complete', 'completed', 'done', 'closed']);

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function taskDate(task) {
  return task.scheduledLondonDate
    || (task.scheduledFor ? getLondonDateKey(task.scheduledFor) : '')
    || task.dueLondonDate
    || (task.dueDate ? getLondonDateKey(task.dueDate) : '');
}

function normalizePriority(priority) {
  const value = String(priority || '').toLowerCase();
  if (value === 'must') return 'critical';
  if (value === 'should') return 'medium';
  if (value === 'nice') return 'someday';
  if (['critical', 'high', 'medium', 'low', 'someday'].includes(value)) return value;
  return 'medium';
}

function backendPriority(priority) {
  return priorityLegacyMap[priority] || priority;
}

function priorityLabel(priority) {
  const normalized = normalizePriority(priority);
  return priorityOptions.find(([value]) => value === normalized)?.[1] || 'Medium';
}

function priorityTone(priority) {
  const normalized = normalizePriority(priority);
  if (normalized === 'critical') return 'bg-red-500';
  if (normalized === 'high') return 'bg-red-400';
  if (normalized === 'medium') return 'bg-blue-400';
  if (normalized === 'low') return 'bg-slate-400';
  return 'bg-slate-500';
}

function categoryLabel(category) {
  return categoryOptions.find(([value]) => value === String(category || '').toLowerCase())?.[1] || 'General';
}

function isCompleted(task) {
  return completedStatuses.has(String(task.status || task.outcome || '').toLowerCase());
}

function isClosed(task) {
  return closedStatuses.has(String(task.status || task.outcome || '').toLowerCase());
}

function isBlocked(task) {
  return String(task.dismissedReason || '').toLowerCase() === 'external_blocker';
}

function taskUiStatus(task, today = getLondonDateKey()) {
  if (isCompleted(task)) return ['completed', 'Completed'];
  if (String(task.status || '').toLowerCase() === 'archived') return ['archived', 'Archived'];
  if (isBlocked(task)) return ['blocked', 'Blocked'];
  const date = taskDate(task);
  if (date && date > today) return ['waiting', 'Waiting'];
  if (String(task.status || '').toLowerCase() === 'rescheduled') return ['waiting', 'Waiting'];
  return ['open', 'Open'];
}

function visibleToday(task, today) {
  const date = taskDate(task);
  return !date || date <= today;
}

function previewText(task) {
  return String(task.expectedDeliverable || task.description || task.notes || '').replace(/\s+/g, ' ').trim();
}

function lines(value) {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function appendNote(existing, heading, value) {
  const note = String(value || '').trim();
  const stamp = new Date().toISOString().slice(0, 10);
  const entry = `[${stamp}] ${heading}${note ? `: ${note}` : ''}`;
  return [String(existing || '').trim(), entry].filter(Boolean).join('\n\n');
}

function tasksForView(view, items, today) {
  const active = items.filter((task) => !isClosed(task) || isBlocked(task));
  if (view === 'completed') return items.filter(isCompleted);
  if (view === 'today') return active.filter((task) => !isBlocked(task) && visibleToday(task, today));
  if (view === 'upcoming') return active.filter((task) => {
    const date = taskDate(task);
    return date && date > today;
  });
  if (view === 'waiting') return active.filter((task) => taskUiStatus(task, today)[0] === 'waiting' || isBlocked(task));
  if (view === 'projects') return active.filter((task) => String(task.category || '').toLowerCase() === 'projects');
  if (view === 'delegated') return active.filter((task) => task.agentReady === true);
  return active.filter((task) => !isBlocked(task) && visibleToday(task, today));
}

function viewCounts(items, today) {
  return Object.fromEntries(views.map(([view]) => [view, tasksForView(view, items, today).length]));
}

function Section({ title, children, defaultOpen = true }) {
  return <details open={defaultOpen} className="border-t border-slate-800 py-5">
    <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
      <span>{title}</span>
    </summary>
    <div className="mt-4">{children}</div>
  </details>;
}

function IconButton({ label, children, className = '', ...props }) {
  return <button
    type="button"
    aria-label={label}
    title={label}
    className={cx('inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-sm text-slate-200 transition hover:border-blue-500 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60', className)}
    {...props}
  >
    {children}
  </button>;
}

function CompletionDialog({ task, open, onClose, onFinish, onPostpone, onBlocked, onCancelled }) {
  const [mode, setMode] = useState('finished');
  const [date, setDate] = useState(addLondonDays(getLondonDateKey(), 1));
  const [reason, setReason] = useState('');
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.classList.add('overflow-hidden');
    window.addEventListener('keydown', closeOnEscape);
    window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      document.body.classList.remove('overflow-hidden');
      window.removeEventListener('keydown', closeOnEscape);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !task) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (mode === 'finished') return onFinish();
    if (mode === 'postponed') return onPostpone(date);
    if (mode === 'blocked') return onBlocked(reason);
    return onCancelled(reason);
  };

  const needsReason = mode === 'blocked' || mode === 'cancelled';
  const needsDate = mode === 'postponed';

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur sm:items-center sm:p-6" role="presentation">
    <form
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
      onSubmit={submit}
      className="w-full max-w-lg rounded-t-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl focus:outline-none sm:rounded-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Complete task</p>
          <h2 id="completion-title" className="mt-1 text-lg font-semibold text-slate-50">{task.title}</h2>
        </div>
        <IconButton label="Close completion dialog" onClick={onClose}>x</IconButton>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {[
          ['finished', 'Finished'],
          ['blocked', 'Blocked'],
          ['postponed', 'Postponed'],
          ['cancelled', 'Cancelled'],
        ].map(([value, label]) => <button
          key={value}
          type="button"
          className={cx('min-h-11 rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500', mode === value ? 'border-blue-500 bg-blue-500/15 text-blue-100' : 'border-slate-700 text-slate-300 hover:bg-slate-900')}
          onClick={() => setMode(value)}
        >
          {label}
        </button>)}
      </div>

      {needsDate ? <label className="mt-4 block text-sm text-slate-300">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">New date</span>
        <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </label> : null}

      {needsReason ? <label className="mt-4 block text-sm text-slate-300">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{mode === 'blocked' ? 'Blocker reason' : 'Optional reason'}</span>
        <textarea
          required={mode === 'blocked'}
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label> : null}

      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 hover:bg-slate-900">Cancel</button>
        <button type="submit" className="min-h-11 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-500">Apply</button>
      </div>
    </form>
  </div>;
}

function TaskSidebar({ selectedView, counts, onSelectView, search, onSearch, onNewTask }) {
  return <aside className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-950 md:w-72 md:border-b-0 md:border-r">
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Tasks</h1>
          <p className="mt-1 text-sm text-slate-500">Scan, choose, execute.</p>
        </div>
        <IconButton label="Quick capture task" onClick={onNewTask}>+</IconButton>
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Search tasks</span>
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search tasks"
          className="min-h-11 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
    </div>
    <nav aria-label="Task views" className="grid gap-1 px-3 pb-4">
      {views.map(([value, label]) => <button
        key={value}
        type="button"
        className={cx('flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500', selectedView === value ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-900')}
        onClick={() => onSelectView(value)}
      >
        <span>{label}</span>
        <span className={cx('rounded-full px-2 py-0.5 text-xs', selectedView === value ? 'bg-blue-500 text-white' : 'bg-slate-900 text-slate-400')}>{counts[value] || 0}</span>
      </button>)}
    </nav>
  </aside>;
}

function TaskListItem({ task, selected, onSelect }) {
  const [statusKey, status] = taskUiStatus(task);
  const date = taskDate(task);
  const preview = previewText(task);

  return <li>
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(task._id)}
      className={cx('group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950', selected ? 'border-blue-500 bg-blue-500/10' : 'border-transparent bg-transparent hover:border-slate-800 hover:bg-slate-900/70')}
    >
      <span className={cx('mt-1 h-2.5 w-2.5 rounded-full', priorityTone(task.priority))} aria-label={`${priorityLabel(task.priority)} priority`} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-6 text-slate-100">{task.title || 'Untitled task'}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{date ? `Due ${date}` : status}</span>
          {task.agentReady ? <span>Agent ready</span> : null}
          {preview ? <span className="hidden max-w-[20rem] truncate sm:inline">{preview}</span> : null}
        </span>
      </span>
      <span className={cx('rounded-full px-2 py-1 text-xs font-medium', statusKey === 'blocked' ? 'bg-red-500/10 text-red-200' : statusKey === 'waiting' ? 'bg-amber-500/10 text-amber-200' : statusKey === 'completed' ? 'bg-green-500/10 text-green-200' : 'bg-slate-800 text-slate-300')}>
        {status}
      </span>
    </button>
  </li>;
}

function TaskList({ tasks, selectedId, onSelect }) {
  if (tasks.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-800 p-6 text-sm text-slate-400">No tasks match this view.</div>;
  }

  return <ul className="space-y-1" aria-label="Task list">
    {tasks.map((task) => <TaskListItem key={task._id} task={task} selected={task._id === selectedId} onSelect={onSelect} />)}
  </ul>;
}

function QuickCaptureSheet({ open, onClose, onCreate, isSaving }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [agentReady, setAgentReady] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    await onCreate({ title: title.trim(), priority: backendPriority(priority), agentReady });
    setTitle('');
    setPriority('medium');
    setAgentReady(false);
    onClose();
  };

  return <div className="fixed inset-0 z-40 flex items-end bg-slate-950/70 p-0 backdrop-blur sm:items-center sm:justify-center sm:p-6">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="capture-title" className="w-full rounded-t-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capture</p>
          <h2 id="capture-title" className="mt-1 text-lg font-semibold">New task</h2>
        </div>
        <IconButton label="Close capture" onClick={onClose}>x</IconButton>
      </div>
      <label className="mt-5 block text-sm text-slate-300">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title</span>
        <input ref={inputRef} aria-label="Task title" value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</span>
          <select aria-label="Task priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200">
          <input aria-label="Assignable to Codex" type="checkbox" checked={agentReady} onChange={(event) => setAgentReady(event.target.checked)} />
          Assignable to Codex
        </label>
      </div>
      <button disabled={isSaving} className="mt-5 min-h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">Save task</button>
    </form>
  </div>;
}

function Field({ label, children }) {
  return <label className="block text-sm text-slate-300">
    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>;
}

function TaskActionBar({ task, isClosedTask, onStart, onComplete, onSchedule, onArchive, onDelete, onConvert, onInspect, isSaving }) {
  const [moreOpen, setMoreOpen] = useState(false);

  return <div className="-mx-5 border-b border-slate-800 bg-slate-950/95 px-5 py-3">
    <div className="flex justify-end">
      <div className="relative">
        <IconButton label="More task actions" onClick={() => setMoreOpen((current) => !current)}>...</IconButton>
        {moreOpen ? <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-800 bg-slate-950 p-2 shadow-xl" role="menu">
          <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-60" disabled={isSaving || isClosedTask} onClick={() => { setMoreOpen(false); onSchedule(); }}>Schedule tomorrow</button>
          <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={() => { setMoreOpen(false); onConvert(); }}>Split or convert</button>
          <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={() => { setMoreOpen(false); onArchive(); }}>Archive</button>
          <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-200 hover:bg-red-500/10" onClick={() => { setMoreOpen(false); onDelete(); }}>Delete</button>
        </div> : null}
      </div>
    </div>
  </div>;
}

const inspectorSections = [
  ['overview', 'Overview'],
  ['description', 'Description'],
  ['checklist', 'Checklist'],
  ['notes', 'Notes'],
  ['files', 'Files'],
  ['agent', 'Agent'],
  ['activity', 'Activity'],
  ['automation', 'Automation'],
];

function EmptyState({ children }) {
  return <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">{children}</div>;
}

function MetadataRow({ label, value }) {
  return <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-slate-800 py-3 text-sm last:border-b-0">
    <dt className="text-slate-500">{label}</dt>
    <dd className="min-w-0 break-words text-slate-200">{value || 'None'}</dd>
  </div>;
}

function TaskOverviewPanel({ task, project, closed, onStart, onComplete, onInspect, saveState }) {
  const [statusKey, status] = taskUiStatus(task);
  const date = taskDate(task);
  const preview = previewText(task);

  return <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected task</p>
      <h2 className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-50">{task.title || 'Untitled task'}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-500">Status</p>
          <p className={cx('mt-1 text-sm font-semibold', statusKey === 'blocked' ? 'text-red-200' : statusKey === 'waiting' ? 'text-amber-200' : statusKey === 'completed' ? 'text-green-200' : 'text-slate-100')}>{status}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-500">Priority</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{priorityLabel(task.priority)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-500">Due / schedule</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{date || 'Unscheduled'}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-500">Category / project</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{project?.name || categoryLabel(task.category)}</p>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
        <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-300">{preview || 'No description yet.'}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onStart} disabled={saveState === 'saving' || closed} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{task?.startedAt ? 'Continue' : 'Start'}</button>
        {closed ? null : <button type="button" onClick={onComplete} disabled={saveState === 'saving'} className="min-h-11 rounded-lg border border-green-500/50 px-4 text-sm font-semibold text-green-100 hover:bg-green-500/10 disabled:opacity-60">Complete</button>}
        <button type="button" onClick={onInspect} className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-100 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">Inspect</button>
      </div>
    </div>
  </div>;
}

function TaskInspectorNav({ activeSection, onSectionChange }) {
  return <nav aria-label="Task inspector sections" className="hidden w-44 shrink-0 content-start gap-1 border-r border-slate-800 p-4 md:grid" role="tablist" aria-orientation="vertical">
    {inspectorSections.map(([value, label]) => <button
      key={value}
      type="button"
      onClick={() => onSectionChange(value)}
      role="tab"
      aria-current={activeSection === value ? 'page' : undefined}
      aria-selected={activeSection === value}
      aria-controls={`task-inspector-panel-${value}`}
      id={`task-inspector-tab-${value}`}
      className={cx('min-h-11 whitespace-nowrap rounded-lg px-3 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500', activeSection === value ? 'border border-blue-500 bg-blue-600 text-white' : 'border border-transparent text-slate-300 hover:bg-slate-900')}
    >
      {label}
    </button>)}
  </nav>;
}

function TaskInspectorMobileTabs({ activeSection, onSectionChange }) {
  return <nav aria-label="Task inspector sections" className="border-b border-slate-800 bg-slate-950/95 md:hidden" role="tablist" aria-orientation="horizontal">
    <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
      {inspectorSections.map(([value, label]) => <button
        key={value}
        type="button"
        onClick={() => onSectionChange(value)}
        role="tab"
        aria-selected={activeSection === value}
        aria-controls={`task-inspector-panel-${value}`}
        id={`task-inspector-mobile-tab-${value}`}
        className={cx('min-h-11 shrink-0 rounded-lg border px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500', activeSection === value ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-950/40' : 'border-slate-700 text-slate-300 hover:bg-slate-900')}
      >
        {label}
      </button>)}
    </div>
  </nav>;
}

function TaskInspectorSection({ title, sectionId, children }) {
  const headingId = `inspector-${sectionId}`;
  return <section id={`task-inspector-panel-${sectionId}`} role="tabpanel" aria-labelledby={`task-inspector-tab-${sectionId}`} className="space-y-4">
    <h3 id={headingId} className="text-lg font-semibold text-slate-50">{title}</h3>
    {children}
  </section>;
}

function TaskOverviewSection({ task, draft, project, setField }) {
  return <TaskInspectorSection title="Overview" sectionId="overview">
    <dl className="rounded-xl border border-slate-800 bg-slate-900/30 px-4">
      <MetadataRow label="Title" value={draft.title || task.title} />
      <MetadataRow label="Status" value={taskUiStatus(task)[1]} />
      <MetadataRow label="Priority" value={priorityLabel(draft.priority)} />
      <MetadataRow label="Schedule" value={taskDate(task) || 'Unscheduled'} />
      <MetadataRow label="Category" value={categoryLabel(draft.category)} />
      <MetadataRow label="Project" value={project?.name || draft.projectId} />
    </dl>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Title">
        <input aria-label="Title" value={draft.title} onChange={(event) => setField('title')(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
      <Field label="Priority">
        <select aria-label="Priority" value={normalizePriority(draft.priority)} onChange={(event) => setField('priority')(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Category">
        <select aria-label="Category" value={draft.category} onChange={(event) => setField('category')(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <Field label="Project ID">
        <input aria-label="Project ID" value={draft.projectId} onChange={(event) => setField('projectId')(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </Field>
    </div>
  </TaskInspectorSection>;
}

function TaskDescriptionSection({ draft, setField }) {
  return <TaskInspectorSection title="Description" sectionId="description">
    {draft.description?.trim() ? null : <EmptyState>No description yet.</EmptyState>}
    <textarea aria-label="Description" value={draft.description} onChange={(event) => setField('description')(event.target.value)} rows={10} className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
  </TaskInspectorSection>;
}

function TaskChecklistSection({ draft, setField, checklist }) {
  return <TaskInspectorSection title="Checklist" sectionId="checklist">
    {checklist.length ? <ul className="space-y-2 text-sm text-slate-300">
      {checklist.map((item) => <li key={item} className="flex gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3"><span className="mt-1 h-4 w-4 rounded border border-slate-600" aria-hidden="true" /> <span>{item}</span></li>)}
    </ul> : <EmptyState>No checklist items yet.</EmptyState>}
    <textarea aria-label="Completion checklist" value={draft.acceptanceCriteria} onChange={(event) => setField('acceptanceCriteria')(event.target.value)} rows={7} placeholder="One checklist item per line" className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
  </TaskInspectorSection>;
}

function TaskNotesSection({ draft, setField }) {
  return <TaskInspectorSection title="Notes" sectionId="notes">
    {draft.notes?.trim() ? null : <EmptyState>No notes yet.</EmptyState>}
    <textarea aria-label="Notes" value={draft.notes} onChange={(event) => setField('notes')(event.target.value)} rows={10} className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
  </TaskInspectorSection>;
}

function TaskFilesSection({ draft }) {
  const files = [draft.deliverableLocation, draft.deliverableSummary].filter((value) => String(value || '').trim());
  return <TaskInspectorSection title="Files" sectionId="files">
    {files.length ? <ul className="space-y-2 text-sm text-slate-300">
      {files.map((file) => <li key={file} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">{file}</li>)}
    </ul> : <EmptyState>No files attached.</EmptyState>}
  </TaskInspectorSection>;
}

function TaskAgentSection({ draft, setField, agentOpen, onToggleAgent }) {
  return <TaskInspectorSection title="Agent" sectionId="agent">
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200">
      <input type="checkbox" checked={draft.agentReady} onChange={(event) => setField('agentReady')(event.target.checked)} />
      Assignable to Codex
    </label>
    {draft.codexPrompt?.trim() ? <button type="button" onClick={onToggleAgent} className="min-h-11 rounded-lg border border-blue-500/50 px-4 text-sm font-medium text-blue-100 hover:bg-blue-500/10">{agentOpen ? 'Hide prompt' : 'Show prompt'}</button> : <EmptyState>No agent activity yet.</EmptyState>}
    {agentOpen || !draft.codexPrompt?.trim() ? <textarea aria-label="Agent Instructions Prompt" value={draft.codexPrompt} onChange={(event) => setField('codexPrompt')(event.target.value)} rows={10} className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" /> : null}
  </TaskInspectorSection>;
}

function TaskActivitySection({ task }) {
  const hasOutcome = (task.outcomeHistory || []).length > 0;
  const hasSchedule = (task.scheduleHistory || []).length > 0;
  return <TaskInspectorSection title="Activity" sectionId="activity">
    {hasOutcome ? <div>
      <h4 className="text-sm font-medium text-slate-200">Outcome history</h4>
      <ul className="mt-2 space-y-2 text-sm text-slate-400">
        {task.outcomeHistory.map((item, index) => <li key={`${item.timestamp}-${index}`} className="rounded-lg bg-slate-900 p-3">{item.fromStatus || 'open'} to {item.toStatus} {item.reason ? `- ${item.reason}` : ''}</li>)}
      </ul>
    </div> : null}
    {hasSchedule ? <div>
      <h4 className="text-sm font-medium text-slate-200">Schedule history</h4>
      <ul className="mt-2 space-y-2 text-sm text-slate-400">
        {task.scheduleHistory.map((item, index) => <li key={`${item.changedAt}-${index}`} className="rounded-lg bg-slate-900 p-3">{item.fromScheduledLondonDate || 'unscheduled'} to {item.toScheduledLondonDate}</li>)}
      </ul>
    </div> : null}
    {!hasOutcome && !hasSchedule ? <EmptyState>No activity recorded yet.</EmptyState> : null}
  </TaskInspectorSection>;
}

function TaskAutomationSection({ task, closed, isSaving, onSchedule }) {
  return <TaskInspectorSection title="Automation" sectionId="automation">
    <dl className="rounded-xl border border-slate-800 bg-slate-900/30 px-4">
      <MetadataRow label="Agent ready" value={task.agentReady ? 'Yes' : 'No'} />
      <MetadataRow label="Postponed" value={task.postponedCount ? `${task.postponedCount} times` : 'No'} />
      <MetadataRow label="Last postponed" value={task.lastPostponedAt || 'None'} />
    </dl>
    <button type="button" onClick={onSchedule} disabled={isSaving || closed} className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 hover:bg-slate-900 disabled:opacity-60">Schedule tomorrow</button>
    {!task.agentReady && !task.postponedCount ? <EmptyState>No automation configured.</EmptyState> : null}
  </TaskInspectorSection>;
}

function TaskInspectorHeader({ task, onClose }) {
  return <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur md:static md:px-5 md:pt-4">
    <div className="flex min-h-11 items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task Inspector</p>
        <h2 id="task-inspector-title" className="mt-1 break-words text-lg font-semibold leading-6 text-slate-50 md:truncate">{task.title || 'Untitled task'}</h2>
      </div>
      <IconButton label="Close task inspector" onClick={onClose}>x</IconButton>
    </div>
  </header>;
}

function TaskInspectorContent({ children }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-28 md:p-6">
    {children}
  </div>;
}

function TaskInspectorFooter({ saveState, onSave }) {
  return <footer className="sticky bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:px-5 md:pb-4">
    <div className="flex justify-end">
      <button type="button" onClick={onSave} disabled={saveState === 'saving'} className="min-h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-60 md:w-auto md:min-w-40">{saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save changes'}</button>
    </div>
  </footer>;
}

function TaskInspectorModal({ task, draft, project, open, activeSection, onClose, onSectionChange, setField, checklist, saveState, onSave, agentOpen, onToggleAgent, closed, onSchedule }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.classList.add('overflow-hidden');
    window.addEventListener('keydown', closeOnEscape);
    window.setTimeout(() => modalRef.current?.focus(), 0);
    return () => {
      document.body.classList.remove('overflow-hidden');
      window.removeEventListener('keydown', closeOnEscape);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !task) return null;

  const section = {
    overview: <TaskOverviewSection task={task} draft={draft} project={project} setField={setField} />,
    description: <TaskDescriptionSection draft={draft} setField={setField} />,
    checklist: <TaskChecklistSection draft={draft} setField={setField} checklist={checklist} />,
    notes: <TaskNotesSection draft={draft} setField={setField} />,
    files: <TaskFilesSection draft={draft} />,
    agent: <TaskAgentSection draft={draft} setField={setField} agentOpen={agentOpen} onToggleAgent={onToggleAgent} />,
    activity: <TaskActivitySection task={task} />,
    automation: <TaskAutomationSection task={task} closed={closed} isSaving={saveState === 'saving'} onSchedule={onSchedule} />,
  }[activeSection] || null;

  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-0 backdrop-blur-md md:p-6" role="presentation" data-testid="task-inspector-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div
      ref={modalRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-inspector-title"
      data-testid="task-inspector-modal"
      className="flex h-[100dvh] w-screen flex-col overflow-hidden border-slate-800 bg-slate-950 shadow-2xl outline-none md:h-[min(820px,calc(100vh-48px))] md:w-[min(1100px,calc(100vw-48px))] md:rounded-2xl md:border"
    >
      <TaskInspectorHeader task={task} onClose={onClose} />
      <TaskInspectorMobileTabs activeSection={activeSection} onSectionChange={onSectionChange} />
      <div className="min-h-0 flex-1 md:flex">
        <TaskInspectorNav activeSection={activeSection} onSectionChange={onSectionChange} />
        <TaskInspectorContent>
          {section}
        </TaskInspectorContent>
      </div>
      <TaskInspectorFooter saveState={saveState} onSave={onSave} />
    </div>
  </div>;
}

export function TaskDetailPanel({ task, projects = [], actions, onEnterExecution, compact = false }) {
  const [draft, setDraft] = useState(() => taskToDraft(task));
  const [saveState, setSaveState] = useState('idle');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [activeInspectorSection, setActiveInspectorSection] = useState('overview');

  useEffect(() => {
    setDraft(taskToDraft(task));
  }, [task]);

  if (!task) {
    return <section className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
      Select a task to view details.
    </section>;
  }

  const closed = isClosed(task) && !isBlocked(task);
  const projectItems = Array.isArray(projects) ? projects : [];
  const project = projectItems.find((item) => item._id === draft.projectId);
  const checklist = lines(draft.acceptanceCriteria);

  const setField = (field) => (value) => setDraft((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaveState('saving');
    await actions.update(task._id, { ...draft, projectId: draft.projectId || null, priority: backendPriority(normalizePriority(draft.priority)) });
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 1500);
  };

  const scheduleTomorrow = () => actions.reschedule(task._id, { targetDate: addLondonDays(getLondonDateKey(), 1), reason: 'tomorrow' });
  const archive = () => actions.archive(task._id);
  const remove = () => {
    if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) actions.remove(task._id);
  };
  const convert = () => {
    const replacementTaskId = window.prompt('Replacement task ID');
    if (replacementTaskId) actions.convert(task._id, { replacementTaskId, reason: 'replaced_by_another_task' });
  };
  const start = async () => {
    await actions.update(task._id, { notes: appendNote(draft.notes, 'Started') });
    onEnterExecution?.(task);
  };

  const finish = async () => {
    await actions.complete(task._id);
    setDialogOpen(false);
  };
  const postpone = async (date) => {
    await actions.reschedule(task._id, { targetDate: date, reason: 'postponed' });
    setDialogOpen(false);
  };
  const blocked = async (reason) => {
    await actions.dismiss(task._id, { reason: 'external_blocker', note: reason });
    setDialogOpen(false);
  };
  const cancelled = async (reason) => {
    await actions.dismiss(task._id, { reason: 'task_no_longer_needed', note: reason });
    setDialogOpen(false);
  };

  return <section className={cx('flex h-full min-h-0 flex-col bg-slate-950', compact ? '' : 'border-l border-slate-800')}>
    <TaskActionBar
      task={task}
      isClosedTask={closed}
      isSaving={saveState === 'saving'}
      onStart={start}
      onComplete={() => setDialogOpen(true)}
      onSchedule={scheduleTomorrow}
      onArchive={archive}
      onDelete={remove}
      onConvert={convert}
      onInspect={() => setInspectorOpen(true)}
    />
    <TaskOverviewPanel task={task} project={project} closed={closed} onStart={start} onComplete={() => setDialogOpen(true)} onInspect={() => setInspectorOpen(true)} saveState={saveState} />
    <TaskInspectorModal
      task={task}
      draft={draft}
      project={project}
      open={inspectorOpen}
      activeSection={activeInspectorSection}
      onClose={() => setInspectorOpen(false)}
      onSectionChange={setActiveInspectorSection}
      setField={setField}
      checklist={checklist}
      saveState={saveState}
      onSave={save}
      agentOpen={agentOpen}
      onToggleAgent={() => setAgentOpen((current) => !current)}
      closed={closed}
      onSchedule={scheduleTomorrow}
    />
    <CompletionDialog task={task} open={dialogOpen} onClose={() => setDialogOpen(false)} onFinish={finish} onPostpone={postpone} onBlocked={blocked} onCancelled={cancelled} />
  </section>;
}

function taskToDraft(task) {
  return {
    title: task?.title || '',
    description: task?.description || '',
    priority: normalizePriority(task?.priority),
    category: task?.category || 'general',
    projectId: task?.projectId || '',
    expectedDeliverable: task?.expectedDeliverable || '',
    acceptanceCriteria: task?.acceptanceCriteria || '',
    notes: task?.notes || '',
    codexPrompt: task?.codexPrompt || '',
    agentReady: task?.agentReady === true,
    deliverableRequired: Boolean(task?.deliverableRequired),
    deliverableSummary: task?.deliverableSummary || task?.deliverableDescription || '',
    deliverableLocation: task?.deliverableLocation || task?.deliverableUrl || '',
  };
}

function MobileTaskHome({ tasks, selectedTask, counts, onCapture, onSelect, onExecution }) {
  const todayTasks = tasksForView('today', tasks, getLondonDateKey()).slice(0, 4);
  return <div className="space-y-5 md:hidden">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
      <p className="mt-1 text-sm text-slate-500">Today, waiting, blocked.</p>
    </div>
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Continue current task</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-50">{selectedTask?.title || 'No task selected'}</h2>
      <button disabled={!selectedTask} onClick={() => selectedTask && onExecution(selectedTask)} className="mt-4 min-h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Continue</button>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[
        ['Due', counts.today || 0, 'text-blue-100'],
        ['Waiting', counts.waiting || 0, 'text-amber-100'],
        ['Done', counts.completed || 0, 'text-green-100'],
      ].map(([label, value, tone]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={cx('mt-1 text-2xl font-semibold', tone)}>{value}</p>
      </div>)}
    </div>
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Today's focus</h2>
        <button type="button" onClick={onCapture} className="min-h-11 rounded-lg border border-slate-700 px-3 text-sm text-slate-200">Capture</button>
      </div>
      <TaskList tasks={todayTasks} selectedId={selectedTask?._id} onSelect={onSelect} />
    </div>
  </div>;
}

function TaskExecutionMode({ task, actions, onExit }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  if (!task) return null;
  const checklist = lines(task.acceptanceCriteria);
  const [statusKey, status] = taskUiStatus(task);

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-slate-100">
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-5">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onExit} className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 hover:bg-slate-900">Exit</button>
        <button type="button" onClick={() => setDialogOpen(true)} className="min-h-11 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-500">Complete</button>
      </div>
      <main className="flex-1 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execution mode</p>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">{task.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={cx('rounded-full px-2.5 py-1', statusKey === 'blocked' ? 'bg-red-500/10 text-red-200' : statusKey === 'waiting' ? 'bg-amber-500/10 text-amber-200' : 'bg-blue-500/10 text-blue-200')}>{status}</span>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-slate-300">{priorityLabel(task.priority)}</span>
        </div>
        <section className="mt-8 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Goal</h2>
            <p className="mt-2 leading-7 text-slate-300">{task.expectedDeliverable || task.description || 'Clarify the intended output, then complete the next step.'}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Next step</h2>
            <p className="mt-2 rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-300">{checklist[0] || 'Work the smallest concrete step and update notes before completion.'}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Checklist</h2>
            {checklist.length ? <ul className="mt-3 space-y-2">{checklist.map((item) => <li key={item} className="flex gap-3 rounded-lg border border-slate-800 p-3 text-slate-300"><span className="mt-1 h-4 w-4 rounded border border-slate-600" />{item}</li>)}</ul> : <p className="mt-2 text-slate-500">No checklist yet.</p>}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900 p-4 leading-7 text-slate-300">{task.notes || 'No notes yet.'}</p>
          </div>
          {task.codexPrompt ? <div>
            <h2 className="text-sm font-semibold text-slate-200">Agent output</h2>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm leading-6 text-blue-100">{task.codexPrompt}</pre>
          </div> : null}
        </section>
      </main>
    </div>
    <CompletionDialog
      task={task}
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onFinish={async () => { await actions.complete(task._id); setDialogOpen(false); onExit(); }}
      onPostpone={async (date) => { await actions.reschedule(task._id, { targetDate: date, reason: 'postponed' }); setDialogOpen(false); onExit(); }}
      onBlocked={async (reason) => { await actions.dismiss(task._id, { reason: 'external_blocker', note: reason }); setDialogOpen(false); onExit(); }}
      onCancelled={async (reason) => { await actions.dismiss(task._id, { reason: 'task_no_longer_needed', note: reason }); setDialogOpen(false); onExit(); }}
    />
  </div>;
}

export function Tasks() {
  const [selectedView, setSelectedView] = useState('today');
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [executionTask, setExecutionTask] = useState(null);
  const tasks = useResource('tasks');
  const projects = useResource('projects');
  const items = tasks.data || [];
  const today = getLondonDateKey();

  const counts = useMemo(() => viewCounts(items, today), [items, today]);
  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasksForView(selectedView, items, today)
      .filter((task) => !query || `${task.title} ${task.description} ${task.notes} ${task.expectedDeliverable}`.toLowerCase().includes(query))
      .sort((left, right) => {
        const leftDate = taskDate(left) || '9999-99-99';
        const rightDate = taskDate(right) || '9999-99-99';
        if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
        return normalizePriority(left.priority).localeCompare(normalizePriority(right.priority));
      });
  }, [items, search, selectedView, today]);

  useEffect(() => {
    if (visibleTasks.length === 0) {
      setSelectedId('');
      return;
    }
    if (!visibleTasks.some((task) => task._id === selectedId)) setSelectedId(visibleTasks[0]._id);
  }, [selectedId, visibleTasks]);

  const selectedTask = items.find((task) => task._id === selectedId) || visibleTasks[0] || null;
  const actions = {
    update: (id, payload) => tasks.update.mutateAsync({ id, payload }),
    remove: (id) => tasks.remove.mutateAsync(id),
    complete: (id) => tasks.complete.mutateAsync(id),
    archive: (id) => tasks.archive.mutateAsync(id),
    dismiss: (id, payload) => tasks.dismiss.mutateAsync({ id, payload }),
    convert: (id, payload) => tasks.convert.mutateAsync({ id, payload }),
    reschedule: (id, payload) => tasks.reschedule.mutateAsync({ id, payload }),
  };

  return <div className="min-h-[calc(100vh-5rem)]">
    <div className="grid min-h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 md:min-h-[calc(100vh-5rem)] md:grid-cols-[minmax(360px,42%)_minmax(0,1fr)] lg:grid-cols-[420px_minmax(0,1fr)]">
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <TaskSidebar selectedView={selectedView} counts={counts} onSelectView={setSelectedView} search={search} onSearch={setSearch} onNewTask={() => setCaptureOpen(true)} />
        <div className="min-h-0 overflow-y-auto p-3">
          <TaskList tasks={visibleTasks} selectedId={selectedTask?._id} onSelect={setSelectedId} />
        </div>
      </div>
      <TaskDetailPanel task={selectedTask} projects={Array.isArray(projects.data) ? projects.data : []} actions={actions} onEnterExecution={setExecutionTask} />
    </div>

    <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-800 bg-slate-950/95 px-2 py-2 backdrop-blur md:hidden">
      {[
        ['Home', 'today'],
        ['Tasks', 'inbox'],
        ['Capture', 'capture'],
        ['Projects', 'projects'],
        ['More', 'completed'],
      ].map(([label, value]) => <button
        key={label}
        type="button"
        onClick={() => value === 'capture' ? setCaptureOpen(true) : setSelectedView(value)}
        className={cx('min-h-11 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500', selectedView === value ? 'bg-blue-600 text-white' : 'text-slate-400')}
      >
        {label}
      </button>)}
    </div>

    <QuickCaptureSheet open={captureOpen} onClose={() => setCaptureOpen(false)} onCreate={(payload) => tasks.create.mutateAsync(payload)} isSaving={tasks.create.isPending} />
    {executionTask ? <TaskExecutionMode task={items.find((task) => task._id === executionTask._id) || executionTask} actions={actions} onExit={() => setExecutionTask(null)} /> : null}
  </div>;
}
