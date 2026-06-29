import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/resources';
import { Card } from '../components/Card';

const categories = [
  ['projects', 'Projects'],
  ['family', 'Family'],
  ['personal', 'Personal'],
  ['admin', 'Admin'],
  ['general', 'General']
];

const priorities = [
  ['must', 'Must Do'],
  ['should', 'Should Do'],
  ['nice', 'Nice To Have'],
  ['high', 'High'],
  ['medium', 'Medium'],
  ['low', 'Low']
];

const statuses = [
  ['open', 'Open'],
  ['rescheduled', 'Rescheduled'],
  ['complete', 'Complete'],
  ['dismissed', 'Dismissed'],
  ['converted', 'Converted'],
  ['archived', 'Archived']
];

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

const emptyDraft = {
  title: '',
  status: 'open',
  priority: 'should',
  category: 'general',
  projectId: '',
  description: '',
  deliverableRequired: false,
  expectedDeliverable: '',
  deliverableSummary: '',
  deliverableLocation: '',
  acceptanceCriteria: '',
  notes: '',
  codexPrompt: '',
};

function taskToDraft(task) {
  const hasDeliverable = Boolean(
    task?.deliverableRequired ||
    task?.expectedDeliverable ||
    task?.deliverableSummary ||
    task?.deliverableLocation ||
    task?.deliverableDescription ||
    task?.deliverableUrl
  );

  return {
    title: task?.title || '',
    status: task?.status || 'open',
    priority: task?.priority || 'should',
    category: task?.category || 'general',
    projectId: task?.projectId || '',
    description: task?.description || '',
    deliverableRequired: hasDeliverable,
    expectedDeliverable: task?.expectedDeliverable || '',
    deliverableSummary: task?.deliverableSummary || task?.deliverableDescription || '',
    deliverableLocation: task?.deliverableLocation || task?.deliverableUrl || '',
    acceptanceCriteria: task?.acceptanceCriteria || '',
    notes: task?.notes || '',
    codexPrompt: task?.codexPrompt || '',
  };
}

function labelFor(options, value, fallback = '') {
  return options.find(([optionValue]) => optionValue === value)?.[1] || fallback || value;
}

function statusSummary(value) {
  const normalized = String(value || 'open').toLowerCase();
  if (normalized === 'complete') return 'Complete';
  if (normalized === 'rescheduled') return 'Rescheduled';
  if (normalized === 'dismissed') return 'Dismissed';
  if (normalized === 'converted') return 'Converted';
  if (normalized === 'archived') return 'Archived';
  return 'Open';
}

function TextInput({ label, value, onChange, required = false }) {
  return <label className="block text-sm text-slate-300">
    <span className="mb-1 block text-xs uppercase text-slate-400">{label}</span>
    <input
      aria-label={label}
      required={required}
      className="w-full rounded border border-slate-700 bg-slate-950 p-3 text-slate-100"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>;
}

function SelectInput({ label, value, options, onChange }) {
  return <label className="block text-sm text-slate-300">
    <span className="mb-1 block text-xs uppercase text-slate-400">{label}</span>
    <select
      aria-label={label}
      className="w-full rounded border border-slate-700 bg-slate-950 p-3 text-slate-100"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
    </select>
  </label>;
}

function TextAreaSection({ title, value, onChange, rows = 8, help = '' }) {
  return <Card title={title}>
    {help ? <p className="mb-3 text-sm text-slate-400">{help}</p> : null}
    <textarea
      aria-label={title}
      className="min-h-48 w-full resize-y rounded border border-slate-700 bg-slate-950 p-3 leading-6 text-slate-100"
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </Card>;
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  return <details open={defaultOpen} className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl sm:p-5">
    <summary className="cursor-pointer select-none text-base font-semibold text-slate-100 sm:text-lg">{title}</summary>
    <div className="mt-4 min-w-0 break-words">{children}</div>
  </details>;
}

export function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyDraft);
  const [saveState, setSaveState] = useState('idle');

  const taskQuery = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.tasks.get(id),
    enabled: Boolean(id),
    retry: false,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: api.projects.list,
    retry: false,
  });

  useEffect(() => {
    if (taskQuery.data) setDraft(taskToDraft(taskQuery.data));
  }, [taskQuery.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['tasks', id] });
  };

  const refreshTaskWorkspace = (task) => {
    queryClient.setQueryData(['tasks', id], task);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    setDraft(taskToDraft(task));
  };

  const update = useMutation({
    mutationFn: (payload) => api.tasks.update(id, payload),
    onSuccess: (task) => {
      queryClient.setQueryData(['tasks', id], task);
      invalidate();
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1800);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.tasks.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/tasks');
    },
  });

  const complete = useMutation({ mutationFn: () => api.tasks.complete(id), onSuccess: refreshTaskWorkspace });
  const reopen = useMutation({ mutationFn: () => api.tasks.reopen(id), onSuccess: refreshTaskWorkspace });
  const archive = useMutation({ mutationFn: () => api.tasks.archive(id), onSuccess: refreshTaskWorkspace });
  const dismiss = useMutation({ mutationFn: (payload) => api.tasks.dismiss(id, payload), onSuccess: refreshTaskWorkspace });
  const convert = useMutation({ mutationFn: (payload) => api.tasks.convert(id, payload), onSuccess: refreshTaskWorkspace });

  const setField = (field) => (value) => setDraft((current) => ({ ...current, [field]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaveState('saving');
    await update.mutateAsync({
      ...draft,
      projectId: draft.projectId || null,
    });
  };

  const task = taskQuery.data;
  const status = String(draft.status || task?.status || 'open').toLowerCase();
  const isClosed = ['complete', 'completed', 'dismissed', 'archived', 'converted'].includes(status);
  const project = (projectsQuery.data || []).find((item) => item._id === draft.projectId);
  const metadata = [
    labelFor(priorities, draft.priority, 'Should Do'),
    labelFor(categories, draft.category, 'General'),
    statusSummary(draft.status),
    project?.name,
  ].filter(Boolean).join(' • ');
  const addDeliverable = () => setDraft((current) => ({ ...current, deliverableRequired: true }));
  const dismissTask = () => {
    const reasonInput = window.prompt(`Dismiss reason:\n${dismissalReasons.map(([, label], index) => `${index + 1}. ${label}`).join('\n')}`, '1');
    if (!reasonInput) return;
    const reason = dismissalReasons[Number(reasonInput) - 1]?.[0]
      || dismissalReasons.find(([value, label]) => value === reasonInput || label.toLowerCase() === reasonInput.toLowerCase())?.[0];
    if (!reason) return;
    const note = window.prompt('Optional dismissal note', '') || '';
    const markProjectInactive = reason === 'project_abandoned' && draft.projectId
      ? window.confirm('Also mark the linked project inactive? Cancel dismisses this task only.')
      : false;
    dismiss.mutate({ reason, note, markProjectInactive });
  };
  const convertTask = () => {
    const replacementTaskId = window.prompt('Replacement task ID');
    if (!replacementTaskId) return;
    convert.mutate({ replacementTaskId, reason: 'replaced_by_another_task' });
  };

  if (taskQuery.isLoading) return null;
  if (taskQuery.isError) return <div className="space-y-4">
    <button type="button" className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800" onClick={() => navigate('/tasks')}>Back</button>
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-100">Task could not be loaded.</div>
  </div>;

  return <form onSubmit={save} className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <button type="button" className="mb-3 rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800" onClick={() => navigate('/tasks')}>← Back</button>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task workspace</p>
        <h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">{draft.title || task?.title || 'Task Details'}</h1>
        {metadata ? <p className="mt-2 text-sm text-slate-400">{metadata}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500">{saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save'}</button>
        {isClosed
          ? <button type="button" className="rounded-lg border border-slate-600 px-4 py-3 font-medium text-slate-200 hover:bg-slate-800" onClick={() => reopen.mutate()}>Reopen task</button>
          : <button type="button" className="rounded-lg border border-emerald-500/60 px-4 py-3 font-medium text-emerald-100 hover:bg-emerald-500/10" onClick={() => complete.mutate()}>Complete task</button>}
        {!isClosed ? <button type="button" className="rounded-lg border border-amber-500/60 px-4 py-3 font-medium text-amber-100 hover:bg-amber-500/10" onClick={dismissTask}>Dismiss task</button> : null}
        {!isClosed ? <button type="button" className="rounded-lg border border-cyan-500/60 px-4 py-3 font-medium text-cyan-100 hover:bg-cyan-500/10" onClick={convertTask}>Convert task</button> : null}
        <button type="button" className="rounded-lg border border-slate-600 px-4 py-3 font-medium text-slate-200 hover:bg-slate-800" onClick={() => archive.mutate()}>Archive task</button>
        <button type="button" className="rounded-lg border border-red-500/60 px-4 py-3 font-medium text-red-100 hover:bg-red-500/10" onClick={() => remove.mutate()}>Delete</button>
      </div>
    </div>

    <TextInput label="Title" value={draft.title} onChange={setField('title')} required />

    <TextAreaSection title="Task" value={draft.description} onChange={setField('description')} help="What needs to be done?" />

    {draft.deliverableRequired ? <>
      <Card title="Success Criteria">
        <p className="mb-4 text-sm text-slate-400">What success looks like before this task is completed.</p>
        <div className="space-y-4">
          <label className="block text-sm text-slate-300">
            <span className="mb-1 block text-xs uppercase text-slate-400">Expected Output</span>
            <textarea
              aria-label="Expected Output"
              className="min-h-36 w-full resize-y rounded border border-slate-700 bg-slate-950 p-3 leading-6 text-slate-100"
              rows={5}
              value={draft.expectedDeliverable}
              onChange={(event) => setField('expectedDeliverable')(event.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-300">
            <span className="mb-1 block text-xs uppercase text-slate-400">Completion Checklist</span>
            <textarea
              aria-label="Completion Checklist"
              className="min-h-36 w-full resize-y rounded border border-slate-700 bg-slate-950 p-3 leading-6 text-slate-100"
              rows={5}
              value={draft.acceptanceCriteria}
              onChange={(event) => setField('acceptanceCriteria')(event.target.value)}
            />
          </label>
        </div>
      </Card>

      <Card title="Your Work" className="border-blue-500/50 bg-blue-950/20 shadow-blue-950/30">
        <div className="space-y-4">
          <label className="block text-sm text-slate-300">
            <span className="mb-1 block text-xs uppercase text-slate-400">Produced Output</span>
            <textarea
              aria-label="Produced Output"
              className="min-h-36 w-full resize-y rounded border border-blue-500/50 bg-slate-950 p-3 leading-6 text-slate-100 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              rows={4}
              value={draft.deliverableSummary}
              onChange={(event) => setField('deliverableSummary')(event.target.value)}
            />
          </label>
          <TextInput label="Supporting Link" value={draft.deliverableLocation} onChange={setField('deliverableLocation')} />
          <label className="block text-sm text-slate-300">
            <span className="mb-1 block text-xs uppercase text-slate-400">Notes</span>
            <textarea
              aria-label="Notes"
              className="min-h-36 w-full resize-y rounded border border-blue-500/40 bg-slate-950 p-3 leading-6 text-slate-100 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              rows={5}
              value={draft.notes}
              onChange={(event) => setField('notes')(event.target.value)}
            />
          </label>
        </div>
      </Card>
    </> : <button type="button" className="rounded-lg border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800" onClick={addDeliverable}>+ Add deliverable</button>}

    <CollapsibleSection title="Advanced">
      <div className="space-y-4">
        <CollapsibleSection title="Codex Prompt">
          <div className="mb-3 flex justify-end">
            <button type="button" className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800" onClick={() => navigator.clipboard?.writeText(draft.codexPrompt || '')}>Copy prompt</button>
          </div>
          <textarea
            aria-label="Codex Prompt"
            className="min-h-48 w-full resize-y rounded border border-slate-700 bg-slate-950 p-3 leading-6 text-slate-100"
            rows={8}
            value={draft.codexPrompt}
            onChange={(event) => setField('codexPrompt')(event.target.value)}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Task Settings">
          <div className="grid gap-4 lg:grid-cols-2">
            <SelectInput label="Status" value={draft.status} options={statuses} onChange={setField('status')} />
            <SelectInput label="Priority" value={draft.priority} options={priorities} onChange={setField('priority')} />
            <SelectInput label="Category" value={draft.category} options={categories} onChange={setField('category')} />
            <div className="lg:col-span-2">
              <TextInput label="Related Project" value={draft.projectId} onChange={setField('projectId')} />
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </CollapsibleSection>
  </form>;
}
