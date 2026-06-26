import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource';

const emptyProject = {
  name: '',
  status: 'active',
  priority: 'medium',
  focusToday: false,
  executionState: 'planning',
  progressPercent: 0,
  problemStatement: '',
  vision: '',
  prd: '',
  definitionOfDone: '',
  summary: '',
  blockers: [],
  agentPrompt: '',
  productionReadiness: '',
  productionChecklist: [],
  nextActionableSteps: [],
  progressUpdates: []
};

function createEmptyProject() {
  return {
    ...emptyProject,
    blockers: [],
    productionChecklist: [],
    nextActionableSteps: [],
    progressUpdates: []
  };
}

const executionStates = ['planning', 'in_progress', 'blocked', 'review_required', 'ready_for_production', 'completed'];
const priorities = ['low', 'medium', 'high'];

function normalizeProject(project = {}) {
  return {
    ...createEmptyProject(),
    ...project,
    progressPercent: Number(project.progressPercent ?? 0),
    blockers: project.blockers ?? [],
    productionChecklist: project.productionChecklist ?? [],
    nextActionableSteps: project.nextActionableSteps ?? [],
    progressUpdates: project.progressUpdates ?? []
  };
}

function Field({ label, children }) {
  return <label className="block min-w-0 text-sm font-medium text-slate-300">
    <span>{label}</span>
    <div className="mt-1">{children}</div>
  </label>;
}

function inputClass(isEditing, extra = '') {
  const modeClass = isEditing
    ? 'border-slate-700 bg-slate-950 text-slate-100 focus:border-cyan-400'
    : 'cursor-default border-slate-800 bg-slate-900/50 text-slate-300 opacity-100';

  return `w-full rounded-lg border px-3 py-2 text-sm outline-none transition disabled:opacity-100 ${modeClass} ${extra}`;
}

function Section({ title, children }) {
  return <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
    <h2 className="mb-3 text-base font-semibold text-slate-100">{title}</h2>
    {children}
  </section>;
}

function Spinner() {
  return <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />;
}

function toLines(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function fromLines(value) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

export function Projects() {
  const { data = [], isLoading, create, update, remove } = useResource('projects');
  const projects = useMemo(() => data ?? [], [data]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(createEmptyProject);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!selectedId && projects.length && !isCreatingNew) {
      setSelectedId(projects[0]._id);
      setIsEditing(false);
      return;
    }
    if (selectedId && !isEditing) {
      const selected = projects.find((project) => project._id === selectedId);
      if (selected) setForm(normalizeProject(selected));
    }
  }, [projects, selectedId, isEditing, isCreatingNew]);

  const selectedProject = projects.find((project) => project._id === selectedId);
  const isSaving = create.isPending || update.isPending;
  const isDeleting = remove.isPending;
  const controlsDisabled = !isEditing || isSaving || isDeleting;

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setChecklistItem = (index, patch) => setForm((current) => ({
    ...current,
    productionChecklist: current.productionChecklist.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
  }));
  const setStep = (index, patch) => setForm((current) => ({
    ...current,
    nextActionableSteps: current.nextActionableSteps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step)
  }));
  const removeFromArray = (key, index) => setForm((current) => ({
    ...current,
    [key]: current[key].filter((_, itemIndex) => itemIndex !== index)
  }));

  const startNewProject = () => {
    setSelectedId('');
    setForm(createEmptyProject());
    setFeedback('');
    setIsCreatingNew(true);
    setIsEditing(true);
  };

  const selectProject = (projectId) => {
    setSelectedId(projectId);
    setFeedback('');
    setIsCreatingNew(false);
    setIsEditing(false);
  };

  const cancelEditing = () => {
    if (selectedProject) setForm(normalizeProject(selectedProject));
    else setForm(createEmptyProject());
    setFeedback('');
    setIsCreatingNew(false);
    setIsEditing(false);
  };

  const saveProject = async (event) => {
    event.preventDefault();
    if (!isEditing || isSaving) return;

    setFeedback('Saving project...');

    const payload = {
      ...form,
      progressPercent: Math.max(0, Math.min(100, Number(form.progressPercent) || 0)),
      productionChecklist: form.productionChecklist.filter((item) => item.title?.trim()),
      nextActionableSteps: form.nextActionableSteps.filter((step) => step.title?.trim())
    };

    try {
      if (selectedProject?._id) await update.mutateAsync({ id: selectedProject._id, payload });
      else {
        const created = await create.mutateAsync(payload);
        if (created?._id) setSelectedId(created._id);
      }
      setFeedback('Project saved.');
      setIsCreatingNew(false);
      setIsEditing(false);
    } catch (error) {
      setFeedback(error?.message ? `Save failed: ${error.message}` : 'Save failed.');
    }
  };

  const deleteProject = async () => {
    if (!selectedProject?._id || isDeleting) return;
    setFeedback('Deleting project...');
    try {
      await remove.mutateAsync(selectedProject._id);
      setSelectedId('');
      setForm(createEmptyProject());
      setIsCreatingNew(false);
      setIsEditing(false);
      setFeedback('Project deleted.');
    } catch (error) {
      setFeedback(error?.message ? `Delete failed: ${error.message}` : 'Delete failed.');
    }
  };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Execution loop</p>
        <h1 className="text-2xl font-semibold text-slate-50">Projects</h1>
      </div>
      <button className="rounded-lg border border-cyan-500 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/10" type="button" onClick={startNewProject}>
        New Project
      </button>
    </div>

    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h2 className="text-sm font-semibold text-slate-300">Saved Projects</h2>
        {isLoading && <p className="text-sm text-slate-500">Loading projects...</p>}
        {!isLoading && !projects.length && <p className="text-sm text-slate-500">No projects saved yet.</p>}
        {projects.map((project) => <button
          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${project._id === selectedId ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}
          key={project._id}
          type="button"
          onClick={() => selectProject(project._id)}
        >
          <span className="block font-medium text-slate-100">{project.name}</span>
          <span className="mt-1 block text-xs text-slate-400">{project.executionState ?? 'planning'} | {project.priority ?? 'medium'}</span>
        </button>)}
      </aside>

      <form className="space-y-4" onSubmit={saveProject}>
        <div className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${isEditing ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-slate-800 bg-slate-900'}`}>
          <div>
            <p className="text-sm font-semibold text-slate-100">{isEditing ? 'Editing project' : 'Viewing project'}</p>
            <p className="text-xs text-slate-400">{isEditing ? 'Fields are active. Save or cancel when finished.' : 'Fields are locked. Click edit to make changes.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {feedback && <span className="text-sm text-slate-300">{feedback}</span>}
            {!isEditing && <button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300" type="button" onClick={() => setIsEditing(true)}>
              Edit project
            </button>}
            {isEditing && <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50" disabled={isSaving || isDeleting} type="button" onClick={cancelEditing}>
              Cancel
            </button>}
          </div>
        </div>

        <Section title="Overview">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Project name">
              <input className={inputClass(isEditing)} disabled={controlsDisabled} required value={form.name} onChange={(event) => setValue('name', event.target.value)} />
            </Field>
            <Field label="Status">
              <input className={inputClass(isEditing)} disabled={controlsDisabled} value={form.status} onChange={(event) => setValue('status', event.target.value)} />
            </Field>
            <Field label="Priority">
              <select className={inputClass(isEditing)} disabled={controlsDisabled} value={form.priority} onChange={(event) => setValue('priority', event.target.value)}>
                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </Field>
            <Field label="Execution state">
              <select className={inputClass(isEditing)} disabled={controlsDisabled} value={form.executionState} onChange={(event) => setValue('executionState', event.target.value)}>
                {executionStates.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            </Field>
            <Field label="Progress percent">
              <input className={inputClass(isEditing)} disabled={controlsDisabled} max="100" min="0" type="number" value={form.progressPercent} onChange={(event) => setValue('progressPercent', event.target.value)} />
            </Field>
            <label className={`flex items-center gap-2 self-end rounded-lg border px-3 py-2 text-sm ${isEditing ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-800 bg-slate-900/50 text-slate-300'}`}>
              <input checked={form.focusToday} disabled={controlsDisabled} type="checkbox" onChange={(event) => setValue('focusToday', event.target.checked)} />
              Focus today
            </label>
          </div>
        </Section>

        <Section title="Definition">
          <div className="grid gap-3">
            <Field label="Problem statement">
              <textarea className={inputClass(isEditing, 'min-h-24')} disabled={controlsDisabled} value={form.problemStatement} onChange={(event) => setValue('problemStatement', event.target.value)} />
            </Field>
            <Field label="Vision">
              <textarea className={inputClass(isEditing, 'min-h-20')} disabled={controlsDisabled} value={form.vision} onChange={(event) => setValue('vision', event.target.value)} />
            </Field>
            <Field label="PRD">
              <textarea className={inputClass(isEditing, 'min-h-28')} disabled={controlsDisabled} value={form.prd} onChange={(event) => setValue('prd', event.target.value)} />
            </Field>
            <Field label="Definition of done">
              <textarea className={inputClass(isEditing, 'min-h-20')} disabled={controlsDisabled} value={form.definitionOfDone} onChange={(event) => setValue('definitionOfDone', event.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Current State">
          <div className="grid gap-3">
            <Field label="Summary">
              <textarea className={inputClass(isEditing, 'min-h-20')} disabled={controlsDisabled} value={form.summary} onChange={(event) => setValue('summary', event.target.value)} />
            </Field>
            <Field label="Blockers">
              <textarea className={inputClass(isEditing, 'min-h-20')} disabled={controlsDisabled} value={toLines(form.blockers)} onChange={(event) => setValue('blockers', fromLines(event.target.value))} />
            </Field>
            <Field label="Agent prompt">
              <textarea className={inputClass(isEditing, 'min-h-24')} disabled={controlsDisabled} value={form.agentPrompt} onChange={(event) => setValue('agentPrompt', event.target.value)} />
            </Field>
            <Field label="Production readiness">
              <textarea className={inputClass(isEditing, 'min-h-20')} disabled={controlsDisabled} value={form.productionReadiness} onChange={(event) => setValue('productionReadiness', event.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Production Checklist">
          <div className="space-y-2">
            {form.productionChecklist.map((item, index) => <div className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]" key={item._id ?? index}>
              <input aria-label={`Checklist done ${index + 1}`} checked={Boolean(item.done)} disabled={controlsDisabled} type="checkbox" onChange={(event) => setChecklistItem(index, { done: event.target.checked })} />
              <input aria-label={`Checklist title ${index + 1}`} className={inputClass(isEditing)} disabled={controlsDisabled} value={item.title ?? ''} onChange={(event) => setChecklistItem(index, { title: event.target.value })} />
              {isEditing && <button className="rounded-lg border border-red-500/60 px-3 py-2 text-sm text-red-200 disabled:opacity-50" disabled={isSaving || isDeleting} type="button" onClick={() => removeFromArray('productionChecklist', index)}>Delete</button>}
            </div>)}
            {isEditing && <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400 disabled:opacity-50" disabled={isSaving || isDeleting} type="button" onClick={() => setValue('productionChecklist', [...form.productionChecklist, { title: '', done: false }])}>
              Add checklist item
            </button>}
          </div>
        </Section>

        <Section title="Next Actionable Steps">
          <div className="space-y-3">
            {form.nextActionableSteps.map((step, index) => <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-3" key={step._id ?? index}>
              <div className={`grid gap-2 ${isEditing ? 'sm:grid-cols-[auto_minmax(0,1fr)_140px_auto]' : 'sm:grid-cols-[auto_minmax(0,1fr)_140px]'}`}>
                <input aria-label={`Step done ${index + 1}`} checked={Boolean(step.done)} disabled={controlsDisabled} type="checkbox" onChange={(event) => setStep(index, { done: event.target.checked })} />
                <input aria-label={`Step title ${index + 1}`} className={inputClass(isEditing)} disabled={controlsDisabled} value={step.title ?? ''} onChange={(event) => setStep(index, { title: event.target.value })} />
                <select aria-label={`Step priority ${index + 1}`} className={inputClass(isEditing)} disabled={controlsDisabled} value={step.priority ?? 'medium'} onChange={(event) => setStep(index, { priority: event.target.value })}>
                  {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
                {isEditing && <button className="rounded-lg border border-red-500/60 px-3 py-2 text-sm text-red-200 disabled:opacity-50" disabled={isSaving || isDeleting} type="button" onClick={() => removeFromArray('nextActionableSteps', index)}>Delete</button>}
              </div>
              <Field label={`Codex prompt ${index + 1}`}>
                <textarea className={inputClass(isEditing, 'min-h-20')} disabled={controlsDisabled} value={step.codexPrompt ?? ''} onChange={(event) => setStep(index, { codexPrompt: event.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input checked={Boolean(step.reviewRequired)} disabled={controlsDisabled} type="checkbox" onChange={(event) => setStep(index, { reviewRequired: event.target.checked })} />
                Review required
              </label>
            </div>)}
            {isEditing && <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400 disabled:opacity-50" disabled={isSaving || isDeleting} type="button" onClick={() => setValue('nextActionableSteps', [...form.nextActionableSteps, { title: '', done: false, priority: 'medium', codexPrompt: '', reviewRequired: false }])}>
              Add actionable step
            </button>}
          </div>
        </Section>

        <Section title="Progress Updates / History">
          {!form.progressUpdates.length && <p className="text-sm text-slate-500">No progress updates saved yet.</p>}
          <div className="space-y-2">
            {form.progressUpdates.map((updateItem, index) => <article className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm" key={updateItem._id ?? index}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>{updateItem.date ? new Date(updateItem.date).toLocaleDateString() : 'No date'}</span>
                <span>{updateItem.progressPercent ?? 0}%</span>
              </div>
              <p className="mt-2 text-slate-200">{updateItem.summary}</p>
              {!!updateItem.nextActionableSteps?.length && <p className="mt-2 text-slate-400">Next: {updateItem.nextActionableSteps.join(', ')}</p>}
              {!!updateItem.blockers?.length && <p className="mt-1 text-red-200">Blockers: {updateItem.blockers.join(', ')}</p>}
            </article>)}
          </div>
        </Section>

        {isEditing && <div className="flex flex-wrap items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70" disabled={isSaving || isDeleting} type="submit">
            {isSaving && <Spinner />}
            {isSaving ? 'Saving...' : selectedProject ? 'Save changes' : 'Save project'}
          </button>
          <button className="rounded-lg border border-red-500/70 px-4 py-2 text-sm font-semibold text-red-100 disabled:cursor-not-allowed disabled:opacity-40" disabled={!selectedProject || isSaving || isDeleting} type="button" onClick={deleteProject}>
            {isDeleting ? 'Deleting...' : 'Delete project'}
          </button>
        </div>}
      </form>
    </div>
  </div>;
}
