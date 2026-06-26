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
  ['complete', 'Complete'],
  ['archived', 'Archived']
];

const emptyDraft = {
  title: '',
  status: 'open',
  priority: 'should',
  category: 'general',
  projectId: '',
  description: '',
  expectedDeliverable: '',
  deliverableTitle: '',
  deliverableDescription: '',
  deliverableUrl: '',
  acceptanceCriteria: '',
  notes: '',
  codexPrompt: '',
};

function taskToDraft(task) {
  return {
    title: task?.title || '',
    status: task?.status || 'open',
    priority: task?.priority || 'should',
    category: task?.category || 'general',
    projectId: task?.projectId || '',
    description: task?.description || '',
    expectedDeliverable: task?.expectedDeliverable || '',
    deliverableTitle: task?.deliverableTitle || '',
    deliverableDescription: task?.deliverableDescription || '',
    deliverableUrl: task?.deliverableUrl || '',
    acceptanceCriteria: task?.acceptanceCriteria || '',
    notes: task?.notes || '',
    codexPrompt: task?.codexPrompt || '',
  };
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
  const isComplete = String(draft.status || task?.status).toLowerCase() === 'complete';
  const actionLabel = isComplete ? 'Reopen task' : 'Complete task';

  if (taskQuery.isLoading) return <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-slate-300">Loading task...</div>;
  if (taskQuery.isError) return <div className="space-y-4">
    <button type="button" className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800" onClick={() => navigate('/tasks')}>Back</button>
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-100">Task could not be loaded.</div>
  </div>;

  return <form onSubmit={save} className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <button type="button" className="mb-3 rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800" onClick={() => navigate('/tasks')}>Back</button>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task workspace</p>
        <h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">{draft.title || task?.title || 'Task Details'}</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500">{saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save'}</button>
        {isComplete
          ? <button type="button" className="rounded-lg border border-slate-600 px-4 py-3 font-medium text-slate-200 hover:bg-slate-800" onClick={() => reopen.mutate()}>{actionLabel}</button>
          : <button type="button" className="rounded-lg border border-emerald-500/60 px-4 py-3 font-medium text-emerald-100 hover:bg-emerald-500/10" onClick={() => complete.mutate()}>{actionLabel}</button>}
        <button type="button" className="rounded-lg border border-slate-600 px-4 py-3 font-medium text-slate-200 hover:bg-slate-800" onClick={() => archive.mutate()}>Archive task</button>
        <button type="button" className="rounded-lg border border-red-500/60 px-4 py-3 font-medium text-red-100 hover:bg-red-500/10" onClick={() => remove.mutate()}>Delete</button>
      </div>
    </div>

    <Card title="Task Overview">
      <div className="grid gap-4 lg:grid-cols-2">
        <TextInput label="Title" value={draft.title} onChange={setField('title')} required />
        <SelectInput label="Status" value={draft.status} options={statuses} onChange={setField('status')} />
        <SelectInput label="Priority" value={draft.priority} options={priorities} onChange={setField('priority')} />
        <SelectInput label="Category" value={draft.category} options={categories} onChange={setField('category')} />
        <div className="lg:col-span-2">
          <TextInput label="Related Project" value={draft.projectId} onChange={setField('projectId')} />
        </div>
      </div>
    </Card>

    <TextAreaSection title="Description" value={draft.description} onChange={setField('description')} help="Execution context for the work to do." />

    <Card title="Deliverable">
      <p className="mb-4 text-sm text-slate-400">Optional output details attached to this task. Completing the task is the lifecycle event.</p>
      <div className="space-y-4">
        <label className="block text-sm text-slate-300">
          <span className="mb-1 block text-xs uppercase text-slate-400">Expected Deliverable</span>
          <textarea
            aria-label="Expected Deliverable"
            className="min-h-36 w-full resize-y rounded border border-slate-700 bg-slate-950 p-3 leading-6 text-slate-100"
            rows={5}
            value={draft.expectedDeliverable}
            onChange={(event) => setField('expectedDeliverable')(event.target.value)}
          />
        </label>
        <TextInput label="Produced Deliverable Title" value={draft.deliverableTitle} onChange={setField('deliverableTitle')} />
        <TextInput label="Produced Deliverable Link" value={draft.deliverableUrl} onChange={setField('deliverableUrl')} />
        <label className="block text-sm text-slate-300">
          <span className="mb-1 block text-xs uppercase text-slate-400">Produced Deliverable Notes</span>
          <textarea
            aria-label="Produced Deliverable Notes"
            className="min-h-36 w-full resize-y rounded border border-slate-700 bg-slate-950 p-3 leading-6 text-slate-100"
            rows={5}
            value={draft.deliverableDescription}
            onChange={(event) => setField('deliverableDescription')(event.target.value)}
          />
        </label>
      </div>
    </Card>

    <TextAreaSection title="Acceptance Criteria" value={draft.acceptanceCriteria} onChange={setField('acceptanceCriteria')} />
    <TextAreaSection title="Notes" value={draft.notes} onChange={setField('notes')} />
    <TextAreaSection title="Codex Prompt" value={draft.codexPrompt} onChange={setField('codexPrompt')} rows={10} />
  </form>;
}
