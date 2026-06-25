import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';

const groups = [['must', 'Must Do'], ['should', 'Should Do'], ['nice', 'Nice To Have']];
const hiddenStatuses = new Set(['complete', 'completed', 'archived']);
const categories = [
  ['projects', 'Projects'],
  ['family', 'Family'],
  ['personal', 'Personal'],
  ['admin', 'Admin'],
  ['general', 'General']
];
const tabs = [['all', 'All'], ['agent', 'Agent'], ...categories];

function normalizeCategory(category) {
  return categories.some(([value]) => value === category) ? category : 'general';
}

export function Tasks() {
  const [selectedTab, setSelectedTab] = useState('all');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('should');
  const [category, setCategory] = useState('general');
  const [agentReady, setAgentReady] = useState(false);
  const tasks = useResource('tasks');
  const items = tasks.data || [];
  const activeItems = items.filter((task) => !hiddenStatuses.has(String(task.status || '').toLowerCase()));
  const filteredItems = activeItems.filter((task) => {
    const taskCategory = normalizeCategory(task.category);
    if (selectedTab === 'all') return true;
    if (selectedTab === 'agent') return task.agentReady === true;
    return taskCategory === selectedTab;
  });

  const save = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    await tasks.create.mutateAsync({ title: title.trim(), priority, category, agentReady });
    setTitle('');
    setPriority('should');
    setCategory('general');
    setAgentReady(false);
  };

  const renderTask = (task) => {
    const taskCategory = normalizeCategory(task.category);
    const isAgentReady = task.agentReady === true;

    return <li key={task._id} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
    <input aria-label={`Task title ${task._id}`} className="w-full rounded bg-slate-950 p-3 font-medium" defaultValue={task.title} onBlur={(e) => tasks.update.mutate({ id: task._id, payload: { title: e.target.value } })} />
    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label className="text-sm text-slate-300">
        <span className="mb-1 block text-xs uppercase text-slate-400">Category</span>
        <select
          aria-label={`Category for ${task.title}`}
          className="w-full rounded border border-slate-700 bg-slate-950 p-2"
          defaultValue={taskCategory}
          onChange={(e) => tasks.update.mutate({ id: task._id, payload: { category: e.target.value } })}
        >
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
        <input
          aria-label={`Assignable to Codex for ${task.title}`}
          type="checkbox"
          defaultChecked={isAgentReady}
          onChange={(e) => tasks.update.mutate({ id: task._id, payload: { agentReady: e.target.checked } })}
        />
        Assignable to Codex
      </label>
    </div>
    <p className="mt-2 text-xs uppercase text-slate-400">{task.status || 'open'} - {categories.find(([value]) => value === taskCategory)?.[1]}{isAgentReady ? ' - Agent' : ''}</p>
    <div className="mt-3 flex flex-wrap gap-3 text-sm">
      <button onClick={() => tasks.complete.mutate(task._id)}>Complete</button>
      <button onClick={() => tasks.reopen.mutate(task._id)}>Reopen</button>
      <button onClick={() => tasks.archive.mutate(task._id)}>Archive</button>
    </div>
  </li>;
  };

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold sm:text-3xl">Tasks</h1>
    <Card title="Create Task">
      <form onSubmit={save} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_180px_auto_auto] lg:items-end">
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
        <label className="text-sm text-slate-300">
          <span className="mb-1 block text-xs uppercase text-slate-400">Category</span>
          <select aria-label="Task category" className="w-full rounded border border-slate-700 bg-slate-950 p-3" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
      {tabs.map(([value, label]) => <button
        key={value}
        type="button"
        className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${selectedTab === value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        onClick={() => setSelectedTab(value)}
      >
        {label}
      </button>)}
    </div>
    {groups.map(([priority, groupTitle]) => {
      const groupItems = filteredItems.filter((task) => task.priority === priority);
      return <Card key={priority} title={groupTitle}><ul className="space-y-2">{groupItems.map(renderTask)}</ul></Card>;
    })}
  </div>;
}
