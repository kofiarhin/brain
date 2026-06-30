import { useRef, useState } from 'react';
import { addLondonDays, getLondonDateKey, nextWeekendLondonDate } from '../utils/londonDate';

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

export function TaskActionsDropdown({
  task,
  onComplete,
  onReschedule,
  onUpdate,
  onDismiss,
  onArchive,
  onConvert,
  isCompleting = false,
  isRescheduling = false,
  isResolving = false,
  isUpdating = false,
  open = false,
  onOpenChange,
  align = 'right',
}) {
  const [panel, setPanel] = useState('menu');
  const [error, setError] = useState('');
  const dateInputRef = useRef(null);
  const isBusy = isCompleting || isRescheduling || isResolving || isUpdating;

  const setOpen = (value) => {
    setError('');
    if (value) setPanel('menu');
    onOpenChange?.(value);
  };

  const runAction = async (action) => {
    setError('');
    try {
      await action();
      setOpen(false);
    } catch (actionError) {
      setError(actionError?.message || 'Action failed. Try again.');
    }
  };

  const stopEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const openDatePicker = () => {
    const dateInput = dateInputRef.current;
    if (!dateInput) return;
    dateInput.value = '';
    if (typeof dateInput.showPicker === 'function') {
      dateInput.showPicker();
      return;
    }
    dateInput.focus();
    dateInput.click();
  };

  const postpone = (reason) => {
    if (reason === 'pick') {
      openDatePicker();
      return;
    }

    const today = getLondonDateKey();
    const targetDate = {
      tomorrow: addLondonDays(today, 1),
      weekend: nextWeekendLondonDate(today),
      nextWeek: addLondonDays(today, 7),
    }[reason];

    if (targetDate) runAction(() => onReschedule(task._id, { targetDate, reason }));
  };

  const choosePickedDate = (event) => {
    const targetDate = event.target.value;
    if (!targetDate) return;
    runAction(() => onReschedule(task._id, { targetDate, reason: 'pick' }));
  };

  const chooseOutcome = (action) => {
    if (action === 'complete') return runAction(() => onComplete(task._id));
    if (action === 'archive') return runAction(() => onArchive(task._id));
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
      return runAction(() => onDismiss(task._id, { reason: selectedReason, note, markProjectInactive }));
    }
    if (action === 'convert') {
      const replacementTaskId = window.prompt('Replacement task ID');
      if (!replacementTaskId) return;
      return runAction(() => onConvert(task._id, { replacementTaskId, reason: 'replaced_by_another_task' }));
    }
  };

  return <div className="relative inline-block text-left" onClick={(event) => event.stopPropagation()}>
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={`Actions for ${task.title}`}
      className="rounded-full border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-500/60 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isBusy}
      onClick={(event) => {
        stopEvent(event);
        setOpen(!open);
      }}
    >
      Actions
    </button>
    <input
      ref={dateInputRef}
      type="date"
      aria-label={`Pick postpone date for ${task.title}`}
      className="absolute h-px w-px opacity-0"
      tabIndex={-1}
      onChange={choosePickedDate}
      onClick={(event) => event.stopPropagation()}
    />
    {open ? <div className={`absolute z-30 mt-2 w-56 rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-xl shadow-slate-950/50 ${align === 'left' ? 'left-0' : 'right-0'}`} role="menu">
      {panel === 'menu' ? <>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-60" disabled={isCompleting} onClick={() => runAction(() => onComplete(task._id))} type="button">Complete</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-60" disabled={isUpdating || task.agentReady === true} onClick={() => runAction(() => onUpdate(task._id, { agentReady: true }))} type="button">{task.agentReady === true ? 'Assignable to Codex' : 'Reassign to Codex'}</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-60" disabled={isRescheduling} onClick={() => setPanel('postpone')} type="button">Postpone</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-60" disabled={isResolving || isCompleting} onClick={() => setPanel('outcome')} type="button">Outcome</button>
      </> : null}
      {panel === 'postpone' ? <>
        <button className="mb-1 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800" onClick={() => setPanel('menu')} type="button">Back</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800" onClick={() => postpone('tomorrow')} type="button">Tomorrow</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800" onClick={() => postpone('weekend')} type="button">This Weekend</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800" onClick={() => postpone('nextWeek')} type="button">Next Week</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800" onClick={() => postpone('pick')} type="button">Pick Date</button>
      </> : null}
      {panel === 'outcome' ? <>
        <button className="mb-1 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800" onClick={() => setPanel('menu')} type="button">Back</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800" onClick={() => chooseOutcome('complete')} type="button">Complete</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800" onClick={() => chooseOutcome('dismiss')} type="button">Dismiss / No longer relevant</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800" onClick={() => chooseOutcome('archive')} type="button">Archive</button>
        <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800" onClick={() => chooseOutcome('convert')} type="button">Convert / Replace</button>
      </> : null}
      {error ? <p className="mt-2 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-100">{error}</p> : null}
    </div> : null}
  </div>;
}
