import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';
import { getLondonDateKey } from '../utils/londonDate';

const groups = [['must', 'Must Do'], ['should', 'Should Do'], ['nice', 'Nice To Have']];
const hiddenStatuses = new Set(['complete', 'completed', 'done', 'archived']);
const completedStatuses = new Set(['complete', 'completed', 'done']);
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

function statusLabel(status) {
  const normalized = String(status || 'open').toLowerCase();
  if (['complete', 'completed', 'done'].includes(normalized)) return 'Done';
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

function taskMatchesTab(task, tab) {
  if (tab === 'all') return true;
  if (tab === 'agent') return task.agentReady === true;
  return normalizeCategory(task.category) === tab;
}

function tasksForTab(tab, items) {
  return items.filter((task) => isActiveTask(task) && taskMatchesTab(task, tab));
}

function wasCompletedToday(task, todayLondonDate = getLondonDateKey()) {
  return completedStatuses.has(String(task.status || '').toLowerCase()) && getLondonDateKey(task.completedAt) === todayLondonDate;
}

function CompletedTaskCard({ task, tasks }) {
  return <li className="rounded-lg border border-slate-700/80 bg-slate-800/80 p-4 shadow-sm shadow-slate-950/20">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-base font-semibold leading-6 text-slate-50 sm:text-lg">{task.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={badgeClass('done')}>Done</span>
          <span className={badgeClass('category')}>{categoryLabel(normalizeCategory(task.category))}</span>
        </div>
      </div>
      <button className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700" onClick={() => tasks.reopen.mutate(task._id)}>Undo</button>
    </div>
  </li>;
}

function TaskCard({ task, tasks }) {
  const taskCategory = normalizeCategory(task.category);
  const isAgentReady = task.agentReady === true;
  const status = statusLabel(task.status);
  const [isEditing, setIsEditing] = useState(false);
  const [draftCategory, setDraftCategory] = useState(taskCategory);
  const [draftAgentReady, setDraftAgentReady] = useState(isAgentReady);

  const startEditing = () => {
    setDraftCategory(taskCategory);
    setDraftAgentReady(isAgentReady);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraftCategory(taskCategory);
    setDraftAgentReady(isAgentReady);
    setIsEditing(false);
  };

  const saveEditing = async () => {
    await tasks.update.mutateAsync({
      id: task._id,
      payload: { category: draftCategory, agentReady: draftAgentReady }
    });
    setIsEditing(false);
  };

  return <li className="rounded-lg border border-slate-700/80 bg-slate-800/80 p-4 shadow-sm shadow-slate-950/20">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-base font-semibold leading-6 text-slate-50 sm:text-lg">{task.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={badgeClass(status === 'Done' ? 'done' : status === 'Archived' ? 'archived' : 'open')}>{status}</span>
          <span className={badgeClass('category')}>{categoryLabel(taskCategory)}</span>
          {isAgentReady ? <span className={badgeClass('agent')}>Agent-ready</span> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <button className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700" onClick={() => tasks.complete.mutate(task._id)}>Complete</button>
        <button className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700" onClick={() => tasks.reopen.mutate(task._id)}>Reopen</button>
        <button className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700" onClick={() => tasks.archive.mutate(task._id)}>Archive</button>
        <button className="rounded-md border border-blue-500/60 px-3 py-2 text-sm font-medium text-blue-100 hover:bg-blue-500/10" onClick={startEditing}>Edit</button>
      </div>
    </div>
    {isEditing ? <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/80 p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <label className="text-sm text-slate-300">
          <span className="mb-1 block text-xs uppercase text-slate-400">Category</span>
          <select
            aria-label={`Category for ${task.title}`}
            className="w-full rounded border border-slate-700 bg-slate-950 p-2"
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value)}
          >
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
          <input
            aria-label={`Assignable to Codex for ${task.title}`}
            type="checkbox"
            checked={draftAgentReady}
            onChange={(e) => setDraftAgentReady(e.target.checked)}
          />
          Assignable to Codex
        </label>
        <div className="flex gap-2">
          <button type="button" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500" onClick={saveEditing}>Save</button>
          <button type="button" className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800" onClick={cancelEditing}>Cancel</button>
        </div>
      </div>
    </div> : null}
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
  const completedItems = items.filter((task) => wasCompletedToday(task, todayLondonDate));
  const filteredItems = tasksForTab(selectedTab, items);

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
        const tabCount = value === 'completed' ? completedItems.length : tasksForTab(value, items).length;
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
      return <Card key={category} title={groupTitle}><ul className="space-y-3">{groupItems.map((task) => <CompletedTaskCard key={task._id} task={task} tasks={tasks} />)}</ul></Card>;
    }) : groups.map(([priority, groupTitle]) => {
      const groupItems = filteredItems.filter((task) => normalizePriority(task.priority) === priority);
      if (groupItems.length === 0) return null;
      return <Card key={priority} title={groupTitle}><ul className="space-y-3">{groupItems.map((task) => <TaskCard key={task._id} task={task} tasks={tasks} />)}</ul></Card>;
    })}
    {selectedTab === 'completed' && completedItems.length === 0 ? <p className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">No tasks completed today.</p> : null}
    {selectedTab !== 'completed' && filteredItems.length === 0 ? <p className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">No open tasks in this tab.</p> : null}
  </div>;
}
