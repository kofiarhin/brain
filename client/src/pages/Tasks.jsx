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
<<<<<<< HEAD
  if (normalized === 'critical') return 'bg-red-500';
  if (normalized === 'high') return 'bg-red-400';
  if (normalized === 'medium') return 'bg-blue-400';
  if (normalized === 'low') return 'bg-slate-400';
  return 'bg-slate-500';
=======
  if (normalized === 'critical') return 'bg-danger';
  if (normalized === 'high') return 'bg-danger/80';
  if (normalized === 'medium') return 'bg-accent';
  if (normalized === 'low') return 'bg-text-muted';
  return 'bg-muted';
>>>>>>> vercel-dark-theme
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

function dateLabel(value) {
  if (!value) return 'Unscheduled';
  const today = getLondonDateKey();
  if (value === today) return 'Today';
  if (value === addLondonDays(today, 1)) return 'Tomorrow';
  return value;
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

function IconButton({ label, children, className = '', ...props }) {
  return <button
    type="button"
    aria-label={label}
    title={label}
<<<<<<< HEAD
    className={cx('inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-sm font-medium text-slate-200 transition hover:border-sky-500 hover:bg-sky-500/10 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60', className)}
=======
    className={cx('inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border text-sm font-medium text-text-secondary transition hover:border-accent hover:bg-accent-hover/10 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-app disabled:cursor-not-allowed disabled:opacity-60', className)}
>>>>>>> vercel-dark-theme
    {...props}
  >
    {children}
  </button>;
}

function EmptyState({ children }) {
<<<<<<< HEAD
  return <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-500">{children}</div>;
=======
  return <div className="rounded-xl border border-dashed border-border-subtle bg-panel/30 p-4 text-sm text-text-muted">{children}</div>;
>>>>>>> vercel-dark-theme
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

<<<<<<< HEAD
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur sm:items-center sm:p-6" role="presentation">
=======
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-app/70 p-0 backdrop-blur sm:items-center sm:p-6" role="presentation">
>>>>>>> vercel-dark-theme
    <form
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
      onSubmit={submit}
<<<<<<< HEAD
      className="w-full max-w-lg rounded-t-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl focus:outline-none sm:rounded-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Complete task</p>
          <h2 id="completion-title" className="mt-1 text-lg font-semibold text-slate-50">{task.title}</h2>
=======
      className="w-full max-w-lg rounded-t-2xl border border-border-subtle bg-app p-5 shadow-2xl focus:outline-none sm:rounded-2xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Complete task</p>
          <h2 id="completion-title" className="mt-1 text-lg font-semibold text-text-primary">{task.title}</h2>
>>>>>>> vercel-dark-theme
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
<<<<<<< HEAD
          className={cx('min-h-11 rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500', mode === value ? 'border-sky-500 bg-sky-500/15 text-sky-100' : 'border-slate-700 text-slate-300 hover:bg-slate-900')}
=======
          className={cx('min-h-11 rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent', mode === value ? 'border-accent bg-accent-soft/70 text-text-primary' : 'border-border text-text-secondary hover:bg-panel')}
>>>>>>> vercel-dark-theme
          onClick={() => setMode(value)}
        >
          {label}
        </button>)}
      </div>

<<<<<<< HEAD
      {needsDate ? <label className="mt-4 block text-sm text-slate-300">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">New date</span>
        <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500" />
      </label> : null}

      {needsReason ? <label className="mt-4 block text-sm text-slate-300">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{mode === 'blocked' ? 'Blocker reason' : 'Optional reason'}</span>
=======
      {needsDate ? <label className="mt-4 block text-sm text-text-secondary">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">New date</span>
        <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-panel px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
      </label> : null}

      {needsReason ? <label className="mt-4 block text-sm text-text-secondary">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">{mode === 'blocked' ? 'Blocker reason' : 'Optional reason'}</span>
>>>>>>> vercel-dark-theme
        <textarea
          required={mode === 'blocked'}
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
<<<<<<< HEAD
          className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
=======
          className="w-full rounded-lg border border-border bg-panel p-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
>>>>>>> vercel-dark-theme
        />
      </label> : null}

      <div className="mt-5 flex justify-end gap-3">
<<<<<<< HEAD
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 hover:bg-slate-900">Cancel</button>
        <button type="submit" className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500">Apply</button>
=======
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium text-text-secondary hover:bg-panel">Cancel</button>
        <button type="submit" className="min-h-11 rounded-lg bg-success px-4 text-sm font-semibold text-text-inverted hover:bg-success/80">Apply</button>
>>>>>>> vercel-dark-theme
      </div>
    </form>
  </div>;
}

function TaskSearchBar({ search, onSearch }) {
  return <label className="block">
    <span className="sr-only">Search tasks</span>
    <input
      value={search}
      onChange={(event) => onSearch(event.target.value)}
      placeholder="Search tasks"
<<<<<<< HEAD
      className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
=======
      className="min-h-11 w-full rounded-xl border border-border-subtle bg-panel px-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
>>>>>>> vercel-dark-theme
    />
  </label>;
}

function TaskFolderList({ selectedView, counts, onSelectView }) {
  return <nav aria-label="Task folders" className="grid gap-1">
    {views.map(([value, label]) => <button
      key={value}
      type="button"
<<<<<<< HEAD
      className={cx('flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-500', selectedView === value ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:bg-slate-900')}
=======
      className={cx('flex min-h-11 items-center justify-between rounded-lg px-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-accent', selectedView === value ? 'bg-accent text-text-inverted' : 'text-text-secondary hover:bg-panel')}
>>>>>>> vercel-dark-theme
      onClick={() => onSelectView(value)}
      aria-label={`${label} ${counts[value] || 0}`}
    >
      <span>{label}</span>
<<<<<<< HEAD
      <span className={cx('text-xs', selectedView === value ? 'text-slate-600' : 'text-slate-500')}>{counts[value] || 0}</span>
=======
      <span className={cx('text-xs', selectedView === value ? 'text-text-muted' : 'text-text-muted')}>{counts[value] || 0}</span>
>>>>>>> vercel-dark-theme
    </button>)}
  </nav>;
}

function TaskRow({ task, selected, index, onOpen, onComplete, onSnooze, onMore }) {
  const [statusKey] = taskUiStatus(task);
  const date = taskDate(task);
  const preview = previewText(task);
  const touchStart = useRef(null);

  const onKeyDown = (event) => {
    if (event.key === 'Enter') onOpen(task._id);
  };

  const onTouchEnd = (event) => {
    if (!touchStart.current) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (delta > 80) onComplete(task._id);
    if (delta < -80) onSnooze(task._id);
  };

  return <li
<<<<<<< HEAD
    className={cx('group relative border-b border-slate-800/80 transition hover:bg-slate-900/70', selected ? 'bg-slate-900' : 'bg-transparent')}
=======
    className={cx('group relative border-b border-border-subtle/80 transition hover:bg-panel/70', selected ? 'bg-panel' : 'bg-transparent')}
>>>>>>> vercel-dark-theme
    style={{ animationDelay: `${Math.min(index, 10) * 18}ms` }}
    onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
    onTouchEnd={onTouchEnd}
  >
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={() => onOpen(task._id)}
      onKeyDown={onKeyDown}
<<<<<<< HEAD
      className="grid min-h-[72px] w-full grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 md:grid-cols-[auto_minmax(10rem,1.3fr)_minmax(8rem,1fr)_8rem_7rem_auto]"
    >
      <span className={cx('mt-2 h-3 w-3 rounded-full ring-2 ring-slate-700', statusKey === 'completed' ? 'bg-emerald-500' : priorityTone(task.priority))} aria-label={`${priorityLabel(task.priority)} priority`} />
      <span className="min-w-0">
        <span className={cx('block truncate text-sm font-semibold leading-6', isCompleted(task) ? 'text-slate-500 line-through' : 'text-slate-100')}>{task.title || 'Untitled task'}</span>
        <span className="block truncate text-sm text-slate-500 md:hidden">{preview || categoryLabel(task.category)}</span>
      </span>
      <span className="hidden min-w-0 truncate text-sm leading-6 text-slate-500 md:block">{preview || 'No preview yet.'}</span>
      <span className="hidden truncate text-sm leading-6 text-slate-400 md:block">{categoryLabel(task.category)}</span>
      <span className="hidden truncate text-sm leading-6 text-slate-400 md:block">{dateLabel(date)}</span>
      <span className="hidden items-center justify-end gap-2 md:flex">
        {task.agentReady ? <span className="rounded-full border border-sky-500/30 px-2 py-0.5 text-xs text-sky-200" aria-label="Agent ready">AI</span> : null}
      </span>
    </button>
    <div className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 gap-1 rounded-lg bg-slate-950/95 p-1 shadow-xl shadow-slate-950/40 group-hover:flex group-focus-within:flex md:flex md:opacity-0 md:transition md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100">
      <IconButton label="Complete" className="pointer-events-auto border-transparent bg-slate-900" onClick={() => onComplete(task._id)}>Done</IconButton>
      <IconButton label="Snooze" className="pointer-events-auto border-transparent bg-slate-900" onClick={() => onSnooze(task._id)}>Later</IconButton>
      <IconButton label="Star" className="pointer-events-auto border-transparent bg-slate-900" onClick={() => onMore(task._id, 'star')}>Star</IconButton>
      <IconButton label="More task actions" className="pointer-events-auto border-transparent bg-slate-900" onClick={() => onMore(task._id, 'more')}>More</IconButton>
=======
      className="grid min-h-[72px] w-full grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent md:grid-cols-[auto_minmax(10rem,1.3fr)_minmax(8rem,1fr)_8rem_7rem_auto]"
    >
      <span className={cx('mt-2 h-3 w-3 rounded-full ring-2 ring-border', statusKey === 'completed' ? 'bg-success' : priorityTone(task.priority))} aria-label={`${priorityLabel(task.priority)} priority`} />
      <span className="min-w-0">
        <span className={cx('block truncate text-sm font-semibold leading-6', isCompleted(task) ? 'text-text-muted line-through' : 'text-text-primary')}>{task.title || 'Untitled task'}</span>
        <span className="block truncate text-sm text-text-muted md:hidden">{preview || categoryLabel(task.category)}</span>
      </span>
      <span className="hidden min-w-0 truncate text-sm leading-6 text-text-muted md:block">{preview || 'No preview yet.'}</span>
      <span className="hidden truncate text-sm leading-6 text-text-muted md:block">{categoryLabel(task.category)}</span>
      <span className="hidden truncate text-sm leading-6 text-text-muted md:block">{dateLabel(date)}</span>
      <span className="hidden items-center justify-end gap-2 md:flex">
        {task.agentReady ? <span className="rounded-full border border-accent/30 px-2 py-0.5 text-xs text-text-primary" aria-label="Agent ready">AI</span> : null}
      </span>
    </button>
    <div className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 gap-1 rounded-lg bg-app/95 p-1 shadow-xl shadow-app/40 group-hover:flex group-focus-within:flex md:flex md:opacity-0 md:transition md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100">
      <IconButton label="Complete" className="pointer-events-auto border-transparent bg-panel" onClick={() => onComplete(task._id)}>Done</IconButton>
      <IconButton label="Snooze" className="pointer-events-auto border-transparent bg-panel" onClick={() => onSnooze(task._id)}>Later</IconButton>
      <IconButton label="Star" className="pointer-events-auto border-transparent bg-panel" onClick={() => onMore(task._id, 'star')}>Star</IconButton>
      <IconButton label="More task actions" className="pointer-events-auto border-transparent bg-panel" onClick={() => onMore(task._id, 'more')}>More</IconButton>
>>>>>>> vercel-dark-theme
    </div>
  </li>;
}

function TaskInbox({ tasks, selectedId, selectedView, counts, search, onSearch, onSelectView, onOpenTask, onCapture, onComplete, onSnooze, onMore, inboxRef }) {
<<<<<<< HEAD
  return <section className="flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 md:min-h-[calc(100vh-5rem)]">
    <header className="border-b border-slate-800 px-4 py-4 md:px-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Tasks Inbox</h1>
          <p className="mt-1 text-sm text-slate-500">Scan, choose, execute.</p>
        </div>
        <button type="button" onClick={onCapture} className="hidden min-h-11 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-950 hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 md:inline-flex md:items-center">Capture</button>
=======
  return <section className="flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-app md:min-h-[calc(100vh-5rem)]">
    <header className="border-b border-border-subtle px-4 py-4 md:px-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Tasks Inbox</h1>
          <p className="mt-1 text-sm text-text-muted">Scan, choose, execute.</p>
        </div>
        <button type="button" onClick={onCapture} className="hidden min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-text-inverted hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent md:inline-flex md:items-center">Capture</button>
>>>>>>> vercel-dark-theme
      </div>
      <div className="mt-4">
        <TaskSearchBar search={search} onSearch={onSearch} />
      </div>
      <div className="mt-4 overflow-x-auto md:hidden">
        <div className="flex gap-2 pb-1">
          {views.map(([value, label]) => <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selectedView === value}
            onClick={() => onSelectView(value)}
<<<<<<< HEAD
            className={cx('min-h-11 shrink-0 rounded-lg border px-3 text-sm font-medium', selectedView === value ? 'border-slate-100 bg-slate-100 text-slate-950' : 'border-slate-800 text-slate-300')}
=======
            className={cx('min-h-11 shrink-0 rounded-lg border px-3 text-sm font-medium', selectedView === value ? 'border-accent bg-accent text-text-inverted' : 'border-border-subtle text-text-secondary')}
>>>>>>> vercel-dark-theme
            aria-label={`${label} ${counts[value] || 0}`}
          >
            {label}
          </button>)}
        </div>
      </div>
    </header>
    <div className="grid min-h-0 flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">
<<<<<<< HEAD
      <aside className="hidden border-r border-slate-800 p-4 md:block">
=======
      <aside className="hidden border-r border-border-subtle p-4 md:block">
>>>>>>> vercel-dark-theme
        <TaskFolderList selectedView={selectedView} counts={counts} onSelectView={onSelectView} />
      </aside>
      <div ref={inboxRef} className="min-h-0 overflow-y-auto pb-24 md:pb-0">
        {tasks.length ? <ul aria-label="Task list">
          {tasks.map((task, index) => <TaskRow
            key={task._id}
            task={task}
            index={index}
            selected={task._id === selectedId}
            onOpen={onOpenTask}
            onComplete={onComplete}
            onSnooze={onSnooze}
            onMore={onMore}
          />)}
        </ul> : <div className="flex min-h-[18rem] items-center justify-center px-6 text-center">
          <div>
<<<<<<< HEAD
            <p className="text-lg font-semibold text-slate-100">You're all caught up.</p>
            <p className="mt-2 text-sm text-slate-500">No tasks match this folder and search.</p>
=======
            <p className="text-lg font-semibold text-text-primary">You're all caught up.</p>
            <p className="mt-2 text-sm text-text-muted">No tasks match this folder and search.</p>
>>>>>>> vercel-dark-theme
          </div>
        </div>}
      </div>
    </div>
  </section>;
}

function ReaderSection({ title, children }) {
<<<<<<< HEAD
  return <section className="border-t border-slate-800 py-8">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
=======
  return <section className="border-t border-border-subtle py-8">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</h2>
>>>>>>> vercel-dark-theme
    <div className="mt-4">{children}</div>
  </section>;
}

function TaskMetadata({ task, draft, project, onChange }) {
  const [, status] = taskUiStatus(task);
  const date = taskDate(task);
  const items = [
    ['Priority', priorityLabel(draft.priority)],
    ['Due', dateLabel(date)],
    ['Project', project?.name || categoryLabel(draft.category)],
    ['Status', status],
  ];

  return <div className="flex flex-wrap gap-2">
<<<<<<< HEAD
    {items.map(([label, value]) => <span key={label} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </span>)}
    <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 text-sm">
      <span className="text-slate-500">Category</span>
      <select aria-label="Category" value={draft.category} onChange={(event) => onChange('category', event.target.value)} className="bg-transparent font-medium text-slate-100 focus:outline-none">
        {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 text-sm">
      <span className="text-slate-500">Priority</span>
      <select aria-label="Priority" value={normalizePriority(draft.priority)} onChange={(event) => onChange('priority', event.target.value)} className="bg-transparent font-medium text-slate-100 focus:outline-none">
=======
    {items.map(([label, value]) => <span key={label} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-subtle bg-panel/40 px-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </span>)}
    <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-subtle bg-panel/40 px-3 text-sm">
      <span className="text-text-muted">Category</span>
      <select aria-label="Category" value={draft.category} onChange={(event) => onChange('category', event.target.value)} className="bg-transparent font-medium text-text-primary focus:outline-none">
        {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-subtle bg-panel/40 px-3 text-sm">
      <span className="text-text-muted">Priority</span>
      <select aria-label="Priority" value={normalizePriority(draft.priority)} onChange={(event) => onChange('priority', event.target.value)} className="bg-transparent font-medium text-text-primary focus:outline-none">
>>>>>>> vercel-dark-theme
        {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  </div>;
}

function TaskChecklist({ draft, onChange }) {
  const checklist = lines(draft.acceptanceCriteria);
  return <div className="space-y-4">
    {checklist.length ? <ul className="space-y-3">
<<<<<<< HEAD
      {checklist.map((item) => <li key={item} className="flex min-h-11 items-start gap-3 text-slate-300">
        <input type="checkbox" className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500" aria-label={item} />
=======
      {checklist.map((item) => <li key={item} className="flex min-h-11 items-start gap-3 text-text-secondary">
        <input type="checkbox" className="mt-1 h-5 w-5 rounded border-border bg-app text-accent focus:ring-accent" aria-label={item} />
>>>>>>> vercel-dark-theme
        <span className="leading-7">{item}</span>
      </li>)}
    </ul> : <EmptyState>No checklist yet.</EmptyState>}
    <label className="block">
      <span className="sr-only">Completion checklist</span>
<<<<<<< HEAD
      <textarea aria-label="Completion checklist" value={draft.acceptanceCriteria} onChange={(event) => onChange('acceptanceCriteria', event.target.value)} rows={4} placeholder="One checklist item per line" className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500" />
=======
      <textarea aria-label="Completion checklist" value={draft.acceptanceCriteria} onChange={(event) => onChange('acceptanceCriteria', event.target.value)} rows={4} placeholder="One checklist item per line" className="w-full rounded-xl border border-border-subtle bg-panel/40 p-4 text-sm leading-6 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
>>>>>>> vercel-dark-theme
    </label>
  </div>;
}

function TaskNotes({ draft, onChange }) {
  return <div>
    {!draft.notes?.trim() ? <div className="mb-4"><EmptyState>No notes.</EmptyState></div> : null}
<<<<<<< HEAD
    <textarea aria-label="Notes" value={draft.notes} onChange={(event) => onChange('notes', event.target.value)} rows={10} placeholder="Write notes..." className="w-full rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-base leading-7 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500" />
=======
    <textarea aria-label="Notes" value={draft.notes} onChange={(event) => onChange('notes', event.target.value)} rows={10} placeholder="Write notes..." className="w-full rounded-xl border border-border-subtle bg-panel/30 p-4 text-base leading-7 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
>>>>>>> vercel-dark-theme
  </div>;
}

function TaskFiles({ draft }) {
  const files = [
    draft.deliverableLocation && { name: draft.deliverableLocation, detail: 'Location' },
    draft.deliverableSummary && { name: draft.deliverableSummary, detail: 'Summary' },
  ].filter(Boolean);

  if (!files.length) return <EmptyState>No attachments.</EmptyState>;

  return <div className="grid gap-3 sm:grid-cols-2">
<<<<<<< HEAD
    {files.map((file) => <div key={`${file.detail}-${file.name}`} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex h-20 items-center justify-center rounded-lg bg-slate-950 text-xs uppercase tracking-wide text-slate-500">{file.detail}</div>
      <p className="mt-3 break-words text-sm font-medium text-slate-100">{file.name}</p>
      <a href={file.name} className="mt-2 inline-flex text-sm text-sky-300 hover:text-sky-200">Open</a>
=======
    {files.map((file) => <div key={`${file.detail}-${file.name}`} className="rounded-xl border border-border-subtle bg-panel/40 p-4">
      <div className="flex h-20 items-center justify-center rounded-lg bg-app text-xs uppercase tracking-wide text-text-muted">{file.detail}</div>
      <p className="mt-3 break-words text-sm font-medium text-text-primary">{file.name}</p>
      <a href={file.name} className="mt-2 inline-flex text-sm text-text-secondary hover:text-text-primary">Open</a>
>>>>>>> vercel-dark-theme
    </div>)}
  </div>;
}

function TaskAgentPanel({ draft, onChange, agentOpen, onToggleAgent }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
<<<<<<< HEAD
      <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-800 bg-slate-900/40 px-3 text-sm text-slate-300">{draft.agentReady ? 'Ready' : 'Not delegated'}</span>
      <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 text-sm text-slate-200">
        <input type="checkbox" checked={draft.agentReady} onChange={(event) => onChange('agentReady', event.target.checked)} />
        Assignable to Codex
      </label>
      {draft.codexPrompt?.trim() ? <button type="button" onClick={onToggleAgent} className="min-h-10 rounded-lg border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-900">{agentOpen ? 'Hide output' : 'Show output'}</button> : null}
    </div>
    {!draft.codexPrompt?.trim() ? <EmptyState>No agent activity.</EmptyState> : null}
    {agentOpen || !draft.codexPrompt?.trim() ? <textarea aria-label="Agent Instructions Prompt" value={draft.codexPrompt} onChange={(event) => onChange('codexPrompt', event.target.value)} rows={8} className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500" /> : null}
=======
      <span className="inline-flex min-h-10 items-center rounded-lg border border-border-subtle bg-panel/40 px-3 text-sm text-text-secondary">{draft.agentReady ? 'Ready' : 'Not delegated'}</span>
      <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-subtle bg-panel/40 px-3 text-sm text-text-secondary">
        <input type="checkbox" checked={draft.agentReady} onChange={(event) => onChange('agentReady', event.target.checked)} />
        Assignable to Codex
      </label>
      {draft.codexPrompt?.trim() ? <button type="button" onClick={onToggleAgent} className="min-h-10 rounded-lg border border-border px-3 text-sm text-text-secondary hover:bg-panel">{agentOpen ? 'Hide output' : 'Show output'}</button> : null}
    </div>
    {!draft.codexPrompt?.trim() ? <EmptyState>No agent activity.</EmptyState> : null}
    {agentOpen || !draft.codexPrompt?.trim() ? <textarea aria-label="Agent Instructions Prompt" value={draft.codexPrompt} onChange={(event) => onChange('codexPrompt', event.target.value)} rows={8} className="w-full rounded-xl border border-border-subtle bg-panel/40 p-4 text-sm leading-6 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" /> : null}
>>>>>>> vercel-dark-theme
  </div>;
}

function formatActivityDate(value) {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function TaskActivity({ task }) {
  const history = [
    { at: task.createdAt, text: 'Created' },
    ...(task.scheduleHistory || []).map((item) => ({ at: item.changedAt, text: `Scheduled ${item.fromScheduledLondonDate || 'unscheduled'} to ${item.toScheduledLondonDate}` })),
    ...(task.outcomeHistory || []).map((item) => ({ at: item.timestamp, text: `${item.fromStatus || 'open'} to ${item.toStatus || item.toOutcome || 'updated'}${item.reason ? ` - ${item.reason}` : ''}` })),
  ].filter((item) => item.at || item.text);

  if (!history.length) return <EmptyState>No activity recorded yet.</EmptyState>;

  return <ol className="space-y-4">
<<<<<<< HEAD
    {history.map((item, index) => <li key={`${item.at}-${item.text}-${index}`} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 border-b border-slate-800 pb-4 last:border-b-0">
      <time className="text-sm text-slate-500">{formatActivityDate(item.at)}</time>
      <p className="text-sm leading-6 text-slate-300">{item.text}</p>
=======
    {history.map((item, index) => <li key={`${item.at}-${item.text}-${index}`} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 border-b border-border-subtle pb-4 last:border-b-0">
      <time className="text-sm text-text-muted">{formatActivityDate(item.at)}</time>
      <p className="text-sm leading-6 text-text-secondary">{item.text}</p>
>>>>>>> vercel-dark-theme
    </li>)}
  </ol>;
}

function TaskToolbar({ task, closed, isSaving, onBack, onStart, onComplete, onSnooze, onArchive, onDelete, onConvert, onDuplicate }) {
  const [moreOpen, setMoreOpen] = useState(false);
<<<<<<< HEAD
  return <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-3 py-3 backdrop-blur">
=======
  return <header className="sticky top-0 z-20 border-b border-border-subtle bg-app/95 px-3 py-3 backdrop-blur">
>>>>>>> vercel-dark-theme
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <IconButton label="Back" onClick={onBack}>Back</IconButton>
        <IconButton label="Archive" onClick={onArchive}>Archive</IconButton>
        {!closed ? <IconButton label="Complete" onClick={onComplete} disabled={isSaving}>Complete</IconButton> : null}
        <IconButton label="Move" onClick={onSnooze} disabled={isSaving || closed}>Move</IconButton>
        <IconButton label="Delegate" onClick={onDuplicate}>Delegate</IconButton>
      </div>
      <div className="flex items-center gap-2">
<<<<<<< HEAD
        {!closed ? <button type="button" onClick={onStart} disabled={isSaving} className="min-h-11 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-60">{task?.startedAt ? 'Continue' : 'Start'}</button> : null}
        <div className="relative">
          <IconButton label="More task actions" onClick={() => setMoreOpen((current) => !current)}>More</IconButton>
          {moreOpen ? <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-slate-800 bg-slate-950 p-2 shadow-xl" role="menu">
            <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-60" disabled={isSaving || closed} onClick={() => { setMoreOpen(false); onSnooze(); }}>Snooze tomorrow</button>
            <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={() => { setMoreOpen(false); onDuplicate(); }}>Duplicate</button>
            <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900" onClick={() => { setMoreOpen(false); onConvert(); }}>Split or convert</button>
            <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-200 hover:bg-red-500/10" onClick={() => { setMoreOpen(false); onDelete(); }}>Delete</button>
=======
        {!closed ? <button type="button" onClick={onStart} disabled={isSaving} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-text-inverted hover:bg-accent-hover disabled:opacity-60">{task?.startedAt ? 'Continue' : 'Start'}</button> : null}
        <div className="relative">
          <IconButton label="More task actions" onClick={() => setMoreOpen((current) => !current)}>More</IconButton>
          {moreOpen ? <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-border-subtle bg-app p-2 shadow-xl" role="menu">
            <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-panel disabled:opacity-60" disabled={isSaving || closed} onClick={() => { setMoreOpen(false); onSnooze(); }}>Snooze tomorrow</button>
            <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-panel" onClick={() => { setMoreOpen(false); onDuplicate(); }}>Duplicate</button>
            <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-panel" onClick={() => { setMoreOpen(false); onConvert(); }}>Split or convert</button>
            <button type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft/45" onClick={() => { setMoreOpen(false); onDelete(); }}>Delete</button>
>>>>>>> vercel-dark-theme
          </div> : null}
        </div>
      </div>
    </div>
  </header>;
}

export function TaskDetailPanel({ task, projects = [], actions, onEnterExecution, compact = false, onBack }) {
  const [draft, setDraft] = useState(() => taskToDraft(task));
  const [saveState, setSaveState] = useState('idle');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(false);

  useEffect(() => {
    setDraft(taskToDraft(task));
    setEditTitle(false);
  }, [task]);

  if (!task) {
<<<<<<< HEAD
    return <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">
=======
    return <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center rounded-2xl border border-border-subtle bg-app p-8 text-center text-sm text-text-muted">
>>>>>>> vercel-dark-theme
      Select a task to view details.
    </section>;
  }

  const closed = isClosed(task) && !isBlocked(task);
  const projectItems = Array.isArray(projects) ? projects : [];
  const project = projectItems.find((item) => item._id === draft.projectId);
  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const save = async (nextDraft = draft) => {
    setSaveState('saving');
    await actions.update(task._id, { ...nextDraft, projectId: nextDraft.projectId || null, priority: backendPriority(normalizePriority(nextDraft.priority)) });
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 1200);
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
  const duplicate = () => actions.update(task._id, { agentReady: true });
  const start = async () => {
    const nextDraft = { ...draft, notes: appendNote(draft.notes, task.startedAt ? 'Continued' : 'Started') };
    setDraft(nextDraft);
    await save(nextDraft);
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

<<<<<<< HEAD
  return <section className={cx('min-h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 md:min-h-[calc(100vh-5rem)]', compact && 'rounded-none border-0')}>
=======
  return <section className={cx('min-h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-border-subtle bg-app text-text-primary md:min-h-[calc(100vh-5rem)]', compact && 'rounded-none border-0')}>
>>>>>>> vercel-dark-theme
    <TaskToolbar
      task={task}
      closed={closed}
      isSaving={saveState === 'saving'}
      onBack={onBack}
      onStart={start}
      onComplete={() => setDialogOpen(true)}
      onSnooze={scheduleTomorrow}
      onArchive={archive}
      onDelete={remove}
      onConvert={convert}
      onDuplicate={duplicate}
    />
    <main className="mx-auto max-w-[800px] px-5 py-8 md:px-8 md:py-12">
      <div className="space-y-4">
        {editTitle ? <label className="block">
          <span className="sr-only">Title</span>
          <input
            aria-label="Title"
            value={draft.title}
            onChange={(event) => setField('title', event.target.value)}
            onBlur={() => save().then(() => setEditTitle(false))}
<<<<<<< HEAD
            className="w-full rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-3xl font-semibold tracking-tight text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label> : <button type="button" onClick={() => setEditTitle(true)} className="block w-full rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-sky-500">
          <h1 className="break-words text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">{draft.title || 'Untitled task'}</h1>
        </button>}
        <TaskMetadata task={task} draft={draft} project={project} onChange={setField} />
        {saveState !== 'idle' ? <p className="text-sm text-slate-500">{saveState === 'saving' ? 'Saving...' : 'Saved'}</p> : null}
      </div>

      <ReaderSection title="Description">
        <textarea aria-label="Description" value={draft.description} onChange={(event) => setField('description', event.target.value)} onBlur={() => save()} rows={6} placeholder="No description yet." className="w-full rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-base leading-7 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500" />
=======
            className="w-full rounded-xl border border-border-subtle bg-panel/40 px-4 py-3 text-3xl font-semibold tracking-tight text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label> : <button type="button" onClick={() => setEditTitle(true)} className="block w-full rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-accent">
          <h1 className="break-words text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">{draft.title || 'Untitled task'}</h1>
        </button>}
        <TaskMetadata task={task} draft={draft} project={project} onChange={setField} />
        {saveState !== 'idle' ? <p className="text-sm text-text-muted">{saveState === 'saving' ? 'Saving...' : 'Saved'}</p> : null}
      </div>

      <ReaderSection title="Description">
        <textarea aria-label="Description" value={draft.description} onChange={(event) => setField('description', event.target.value)} onBlur={() => save()} rows={6} placeholder="No description yet." className="w-full rounded-xl border border-border-subtle bg-panel/30 p-4 text-base leading-7 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
>>>>>>> vercel-dark-theme
      </ReaderSection>

      <ReaderSection title="Checklist">
        <TaskChecklist draft={draft} onChange={setField} />
      </ReaderSection>

      <ReaderSection title="Notes">
        <TaskNotes draft={draft} onChange={setField} />
      </ReaderSection>

      <ReaderSection title="Files">
        <TaskFiles draft={draft} />
      </ReaderSection>

      <ReaderSection title="Agent">
        <TaskAgentPanel draft={draft} onChange={setField} agentOpen={agentOpen} onToggleAgent={() => setAgentOpen((current) => !current)} />
      </ReaderSection>

      <ReaderSection title="Activity">
        <TaskActivity task={task} />
      </ReaderSection>

      <div className="sticky bottom-4 mt-8 flex justify-end">
<<<<<<< HEAD
        <button type="button" onClick={() => save()} disabled={saveState === 'saving'} className="min-h-11 rounded-lg bg-slate-100 px-5 text-sm font-semibold text-slate-950 shadow-xl shadow-slate-950/30 hover:bg-white disabled:opacity-60">{saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save changes'}</button>
=======
        <button type="button" onClick={() => save()} disabled={saveState === 'saving'} className="min-h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-text-inverted shadow-xl shadow-app/30 hover:bg-accent-hover disabled:opacity-60">{saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save changes'}</button>
>>>>>>> vercel-dark-theme
      </div>
    </main>
    <CompletionDialog task={task} open={dialogOpen} onClose={() => setDialogOpen(false)} onFinish={finish} onPostpone={postpone} onBlocked={blocked} onCancelled={cancelled} />
  </section>;
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

<<<<<<< HEAD
  return <div className="fixed inset-0 z-40 flex items-end bg-slate-950/70 p-0 backdrop-blur sm:items-center sm:justify-center sm:p-6">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="capture-title" className="w-full rounded-t-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capture</p>
          <h2 id="capture-title" className="mt-1 text-lg font-semibold text-slate-50">New task</h2>
        </div>
        <IconButton label="Close capture" onClick={onClose}>x</IconButton>
      </div>
      <label className="mt-5 block text-sm text-slate-300">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title</span>
        <input ref={inputRef} aria-label="Task title" value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500" />
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</span>
          <select aria-label="Task priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500">
            {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200">
=======
  return <div className="fixed inset-0 z-40 flex items-end bg-app/70 p-0 backdrop-blur sm:items-center sm:justify-center sm:p-6">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="capture-title" className="w-full rounded-t-2xl border border-border-subtle bg-app p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Capture</p>
          <h2 id="capture-title" className="mt-1 text-lg font-semibold text-text-primary">New task</h2>
        </div>
        <IconButton label="Close capture" onClick={onClose}>x</IconButton>
      </div>
      <label className="mt-5 block text-sm text-text-secondary">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Title</span>
        <input ref={inputRef} aria-label="Task title" value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-panel px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-text-secondary">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Priority</span>
          <select aria-label="Task priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-panel px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent">
            {priorityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-panel px-3 text-sm text-text-secondary">
>>>>>>> vercel-dark-theme
          <input aria-label="Assignable to Codex" type="checkbox" checked={agentReady} onChange={(event) => setAgentReady(event.target.checked)} />
          Assignable to Codex
        </label>
      </div>
<<<<<<< HEAD
      <button disabled={isSaving} className="mt-5 min-h-11 w-full rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60">Save task</button>
=======
      <button disabled={isSaving} className="mt-5 min-h-11 w-full rounded-lg bg-accent px-4 text-sm font-semibold text-text-inverted hover:bg-accent-hover disabled:opacity-60">Save task</button>
>>>>>>> vercel-dark-theme
    </form>
  </div>;
}

function TaskExecutionMode({ task, actions, onExit }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const checklist = lines(task?.acceptanceCriteria);
  const [statusKey, status] = task ? taskUiStatus(task) : ['open', 'Open'];

  if (!task) return null;

<<<<<<< HEAD
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-slate-100">
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-5">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onExit} className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm text-slate-200 hover:bg-slate-900">Exit</button>
        <button type="button" onClick={() => setDialogOpen(true)} className="min-h-11 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500">Complete</button>
      </div>
      <main className="flex-1 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execution mode</p>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">{task.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={cx('rounded-full px-2.5 py-1', statusKey === 'blocked' ? 'bg-red-500/10 text-red-200' : statusKey === 'waiting' ? 'bg-amber-500/10 text-amber-200' : 'bg-sky-500/10 text-sky-200')}>{status}</span>
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
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm leading-6 text-sky-100">{task.codexPrompt}</pre>
=======
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-app text-text-primary">
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-5">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onExit} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary hover:bg-panel">Exit</button>
        <button type="button" onClick={() => setDialogOpen(true)} className="min-h-11 rounded-lg bg-success px-4 text-sm font-semibold text-text-inverted hover:bg-success/80">Complete</button>
      </div>
      <main className="flex-1 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Execution mode</p>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">{task.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={cx('rounded-full px-2.5 py-1', statusKey === 'blocked' ? 'bg-danger-soft/45 text-danger' : statusKey === 'waiting' ? 'bg-warning-soft/45 text-warning' : 'bg-accent-soft/60 text-text-primary')}>{status}</span>
          <span className="rounded-full bg-panel px-2.5 py-1 text-text-secondary">{priorityLabel(task.priority)}</span>
        </div>
        <section className="mt-8 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-text-secondary">Goal</h2>
            <p className="mt-2 leading-7 text-text-secondary">{task.expectedDeliverable || task.description || 'Clarify the intended output, then complete the next step.'}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-secondary">Next step</h2>
            <p className="mt-2 rounded-xl border border-border-subtle bg-panel p-4 text-text-secondary">{checklist[0] || 'Work the smallest concrete step and update notes before completion.'}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-secondary">Checklist</h2>
            {checklist.length ? <ul className="mt-3 space-y-2">{checklist.map((item) => <li key={item} className="flex gap-3 rounded-lg border border-border-subtle p-3 text-text-secondary"><span className="mt-1 h-4 w-4 rounded border border-border" />{item}</li>)}</ul> : <p className="mt-2 text-text-muted">No checklist yet.</p>}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-secondary">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-border-subtle bg-panel p-4 leading-7 text-text-secondary">{task.notes || 'No notes yet.'}</p>
          </div>
          {task.codexPrompt ? <div>
            <h2 className="text-sm font-semibold text-text-secondary">Agent output</h2>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-accent/20 bg-accent-soft/40 p-4 text-sm leading-6 text-text-primary">{task.codexPrompt}</pre>
>>>>>>> vercel-dark-theme
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
  const [selectedView, setSelectedView] = useState('inbox');
  const [selectedId, setSelectedId] = useState('');
  const [readerOpen, setReaderOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [executionTask, setExecutionTask] = useState(null);
  const inboxRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const tasks = useResource('tasks');
  const projects = useResource('projects');
  const items = tasks.data || [];
  const today = getLondonDateKey();

  const counts = useMemo(() => viewCounts(items, today), [items, today]);
  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasksForView(selectedView, items, today)
      .filter((task) => {
        if (!query) return true;
        const projectName = (projects.data || []).find((project) => project._id === task.projectId)?.name || '';
        return `${task.title} ${task.description} ${task.notes} ${task.expectedDeliverable} ${task.codexPrompt} ${projectName}`.toLowerCase().includes(query);
      })
      .sort((left, right) => {
        const leftDate = taskDate(left) || '9999-99-99';
        const rightDate = taskDate(right) || '9999-99-99';
        if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
        return normalizePriority(left.priority).localeCompare(normalizePriority(right.priority));
      });
  }, [items, projects.data, search, selectedView, today]);

  const selectedTask = items.find((task) => task._id === selectedId) || null;
  const actions = {
    update: (id, payload) => tasks.update.mutateAsync({ id, payload }),
    remove: (id) => tasks.remove.mutateAsync(id),
    complete: (id) => tasks.complete.mutateAsync(id),
    archive: (id) => tasks.archive.mutateAsync(id),
    dismiss: (id, payload) => tasks.dismiss.mutateAsync({ id, payload }),
    convert: (id, payload) => tasks.convert.mutateAsync({ id, payload }),
    reschedule: (id, payload) => tasks.reschedule.mutateAsync({ id, payload }),
  };

  const openTask = (id) => {
    scrollPositionRef.current = inboxRef.current?.scrollTop || 0;
    setSelectedId(id);
    setReaderOpen(true);
  };

  const closeReader = () => {
    setReaderOpen(false);
    window.setTimeout(() => {
      if (inboxRef.current) inboxRef.current.scrollTop = scrollPositionRef.current;
    }, 0);
  };

  const completeTask = (id) => actions.complete(id);
  const snoozeTask = (id) => actions.reschedule(id, { targetDate: addLondonDays(getLondonDateKey(), 1), reason: 'tomorrow' });
  const moreTask = (id, type) => {
    if (type === 'star') return actions.update(id, { priority: 'high' });
    setSelectedId(id);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const currentIndex = visibleTasks.findIndex((task) => task._id === selectedId);
      if (event.key === '/') {
        event.preventDefault();
        document.querySelector('input[placeholder="Search tasks"]')?.focus();
      }
      if (event.key.toLowerCase() === 'c') setCaptureOpen(true);
      if (event.key === 'Escape' && readerOpen) closeReader();
      if (event.key === 'Enter' && !readerOpen && selectedId) openTask(selectedId);
      if ((event.key.toLowerCase() === 'j' || event.key === 'ArrowDown') && visibleTasks.length) {
        event.preventDefault();
        setSelectedId(visibleTasks[Math.min(currentIndex + 1, visibleTasks.length - 1)]?._id || visibleTasks[0]._id);
      }
      if ((event.key.toLowerCase() === 'k' || event.key === 'ArrowUp') && visibleTasks.length) {
        event.preventDefault();
        setSelectedId(visibleTasks[Math.max(currentIndex - 1, 0)]?._id || visibleTasks[0]._id);
      }
      if (event.key.toLowerCase() === 'e' && selectedId) completeTask(selectedId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readerOpen, selectedId, visibleTasks]);

  useEffect(() => {
    if (selectedId && !items.some((task) => task._id === selectedId)) {
      setSelectedId('');
      setReaderOpen(false);
    }
  }, [items, selectedId]);

  return <div className="min-h-[calc(100vh-5rem)]">
    <div className={cx('transition-transform duration-200 ease-out', readerOpen ? '-translate-x-2 md:-translate-x-4' : 'translate-x-0')}>
      {readerOpen && selectedTask ? <TaskDetailPanel
        task={selectedTask}
        projects={Array.isArray(projects.data) ? projects.data : []}
        actions={actions}
        onEnterExecution={setExecutionTask}
        onBack={closeReader}
      /> : <TaskInbox
        tasks={visibleTasks}
        selectedId={selectedId}
        selectedView={selectedView}
        counts={counts}
        search={search}
        onSearch={setSearch}
        onSelectView={(view) => {
          setSelectedView(view);
          setSelectedId('');
        }}
        onOpenTask={openTask}
        onCapture={() => setCaptureOpen(true)}
        onComplete={completeTask}
        onSnooze={snoozeTask}
        onMore={moreTask}
        inboxRef={inboxRef}
      />}
    </div>

<<<<<<< HEAD
    {!readerOpen ? <button type="button" onClick={() => setCaptureOpen(true)} aria-label="Create task" className="fixed bottom-5 right-5 z-30 inline-flex min-h-14 min-w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-950 shadow-xl shadow-slate-950/30 hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 md:bottom-8 md:right-8">+</button> : null}
=======
    {!readerOpen ? <button type="button" onClick={() => setCaptureOpen(true)} aria-label="Create task" className="fixed bottom-5 right-5 z-30 inline-flex min-h-14 min-w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-semibold text-text-inverted shadow-xl shadow-app/30 hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent md:bottom-8 md:right-8">+</button> : null}
>>>>>>> vercel-dark-theme

    <QuickCaptureSheet open={captureOpen} onClose={() => setCaptureOpen(false)} onCreate={(payload) => tasks.create.mutateAsync(payload)} isSaving={tasks.create.isPending} />
    {executionTask ? <TaskExecutionMode task={items.find((task) => task._id === executionTask._id) || executionTask} actions={actions} onExit={() => setExecutionTask(null)} /> : null}
  </div>;
}
