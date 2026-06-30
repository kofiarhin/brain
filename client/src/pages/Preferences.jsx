import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';

const defaultForm = {
  title: 'Default Preferences',
  scheduling: {
    planningWindowStart: '04:00',
    planningWindowEnd: '21:00',
    deepWorkPreferredTime: 'morning',
    gymPreferredTime: 'afternoon',
    meetingAvoidBefore: '10:00',
    bufferTimeRequired: true,
  },
  planning: {
    maxDailyTasks: 5,
    minimizeContextSwitching: true,
    preferHighImpactExecution: true,
    carryOverFirst: true,
  },
  personalConstraints: {
    workFromHome: true,
    familyResponsibilities: true,
    schoolRuns: true,
    helpingLauraWithAto: true,
  },
  output: {
    concise: true,
    includeMotivationalPost: true,
    includeDavidGogginsQuote: true,
    includeStoicQuote: true,
    includeInsightOfTheDay: true,
  },
  agentBehaviour: {
    verbosity: 'concise',
    autonomy: 'medium',
  },
  notes: '',
};

const timeOptions = ['morning', 'midday', 'afternoon', 'evening', 'flexible'];
const verbosityOptions = ['concise', 'balanced', 'detailed'];
const autonomyOptions = ['low', 'medium', 'high'];

function mergePreference(preference = {}) {
  return {
    ...defaultForm,
    ...preference,
    scheduling: { ...defaultForm.scheduling, ...(preference.scheduling || {}) },
    planning: { ...defaultForm.planning, ...(preference.planning || {}) },
    personalConstraints: { ...defaultForm.personalConstraints, ...(preference.personalConstraints || {}) },
    output: { ...defaultForm.output, ...(preference.output || {}) },
    agentBehaviour: { ...defaultForm.agentBehaviour, ...(preference.agentBehaviour || {}) },
  };
}

function TextField({ label, value, onChange, type = 'text', min }) {
  return <label className="grid gap-1 text-sm text-slate-300">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <input
      aria-label={label}
      type={type}
      min={min}
      value={value}
      onChange={(event) => onChange(type === 'number' ? Number(event.target.value) : event.target.value)}
      className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
    />
  </label>;
}

function SelectField({ label, value, options, onChange }) {
  return <label className="grid gap-1 text-sm text-slate-300">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}

function CheckboxField({ label, checked, onChange }) {
  return <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
    <input
      aria-label={label}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-blue-600"
    />
    <span>{label}</span>
  </label>;
}

function Section({ title, children }) {
  return <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
    <h2 className="mb-4 text-base font-semibold text-slate-100">{title}</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  </section>;
}

export function Preferences() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['preferences', 'active'], queryFn: api.preferences.active });
  const [form, setForm] = useState(defaultForm);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (data) setForm(mergePreference(data));
  }, [data]);

  const mutation = useMutation({
    mutationFn: api.preferences.updateActive,
    onSuccess: async () => {
      setSavedMessage('Preferences saved.');
      await queryClient.invalidateQueries({ queryKey: ['preferences', 'active'] });
    },
  });

  const setValue = (section, key, value) => {
    setSavedMessage('');
    setForm((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    await mutation.mutateAsync({ ...form, active: true });
  };

  if (isLoading) return <p className="text-slate-300">Loading preferences...</p>;
  if (isError) return <p className="text-red-300">{error?.message || 'Could not load preferences.'}</p>;

  return <div className="space-y-4">
    <div>
      <h1 className="break-words text-2xl font-bold sm:text-3xl">Preferences</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">Editable planning context used by session generation.</p>
    </div>

    <Card>
      <form onSubmit={save} className="space-y-4">
        <TextField label="Title" value={form.title} onChange={(value) => { setSavedMessage(''); setForm((current) => ({ ...current, title: value })); }} />

        <Section title="Scheduling">
          <TextField label="Planning window start" value={form.scheduling.planningWindowStart} onChange={(value) => setValue('scheduling', 'planningWindowStart', value)} />
          <TextField label="Planning window end" value={form.scheduling.planningWindowEnd} onChange={(value) => setValue('scheduling', 'planningWindowEnd', value)} />
          <TextField label="Meeting avoid before" value={form.scheduling.meetingAvoidBefore} onChange={(value) => setValue('scheduling', 'meetingAvoidBefore', value)} />
          <SelectField label="Deep work preferred time" value={form.scheduling.deepWorkPreferredTime} options={timeOptions} onChange={(value) => setValue('scheduling', 'deepWorkPreferredTime', value)} />
          <SelectField label="Gym preferred time" value={form.scheduling.gymPreferredTime} options={timeOptions} onChange={(value) => setValue('scheduling', 'gymPreferredTime', value)} />
          <CheckboxField label="Buffer time required" checked={form.scheduling.bufferTimeRequired} onChange={(value) => setValue('scheduling', 'bufferTimeRequired', value)} />
        </Section>

        <Section title="Planning">
          <TextField label="Max daily tasks" type="number" min="1" value={form.planning.maxDailyTasks} onChange={(value) => setValue('planning', 'maxDailyTasks', value)} />
          <CheckboxField label="Minimize context switching" checked={form.planning.minimizeContextSwitching} onChange={(value) => setValue('planning', 'minimizeContextSwitching', value)} />
          <CheckboxField label="Prefer high-impact execution" checked={form.planning.preferHighImpactExecution} onChange={(value) => setValue('planning', 'preferHighImpactExecution', value)} />
          <CheckboxField label="Carry over first" checked={form.planning.carryOverFirst} onChange={(value) => setValue('planning', 'carryOverFirst', value)} />
        </Section>

        <Section title="Personal Constraints">
          <CheckboxField label="Work from home" checked={form.personalConstraints.workFromHome} onChange={(value) => setValue('personalConstraints', 'workFromHome', value)} />
          <CheckboxField label="Family responsibilities" checked={form.personalConstraints.familyResponsibilities} onChange={(value) => setValue('personalConstraints', 'familyResponsibilities', value)} />
          <CheckboxField label="School runs" checked={form.personalConstraints.schoolRuns} onChange={(value) => setValue('personalConstraints', 'schoolRuns', value)} />
          <CheckboxField label="Helping Laura with Ato" checked={form.personalConstraints.helpingLauraWithAto} onChange={(value) => setValue('personalConstraints', 'helpingLauraWithAto', value)} />
        </Section>

        <Section title="Output">
          <CheckboxField label="Concise output" checked={form.output.concise} onChange={(value) => setValue('output', 'concise', value)} />
          <CheckboxField label="Include motivational post" checked={form.output.includeMotivationalPost} onChange={(value) => setValue('output', 'includeMotivationalPost', value)} />
          <CheckboxField label="Include David Goggins quote" checked={form.output.includeDavidGogginsQuote} onChange={(value) => setValue('output', 'includeDavidGogginsQuote', value)} />
          <CheckboxField label="Include Stoic quote" checked={form.output.includeStoicQuote} onChange={(value) => setValue('output', 'includeStoicQuote', value)} />
          <CheckboxField label="Include insight of the day" checked={form.output.includeInsightOfTheDay} onChange={(value) => setValue('output', 'includeInsightOfTheDay', value)} />
        </Section>

        <Section title="Agent Behaviour">
          <SelectField label="Verbosity" value={form.agentBehaviour.verbosity} options={verbosityOptions} onChange={(value) => setValue('agentBehaviour', 'verbosity', value)} />
          <SelectField label="Autonomy" value={form.agentBehaviour.autonomy} options={autonomyOptions} onChange={(value) => setValue('agentBehaviour', 'autonomy', value)} />
        </Section>

        <label className="grid gap-1 text-sm text-slate-300">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span>
          <textarea
            aria-label="Notes"
            value={form.notes}
            onChange={(event) => { setSavedMessage(''); setForm((current) => ({ ...current, notes: event.target.value })); }}
            rows={5}
            className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
            {mutation.isPending ? 'Saving...' : 'Save Preferences'}
          </button>
          {mutation.isError && <p className="text-sm text-red-300">{mutation.error?.message || 'Could not save preferences.'}</p>}
          {savedMessage && !mutation.isError && <p className="text-sm text-emerald-300">{savedMessage}</p>}
        </div>
      </form>
    </Card>
  </div>;
}
