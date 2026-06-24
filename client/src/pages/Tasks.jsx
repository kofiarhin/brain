import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';

const groups = [['must', 'Must Do'], ['should', 'Should Do'], ['nice', 'Nice To Have']];

export function Tasks() {
  const tasks = useResource('tasks');
  const items = tasks.data || [];
  const renderTask = (task) => <li key={task._id} className="rounded-lg bg-slate-800 p-3">
    <input className="w-full rounded bg-slate-950 p-3 font-medium" defaultValue={task.title} onBlur={(e) => tasks.update.mutate({ id: task._id, payload: { title: e.target.value } })} />
    <p className="mt-2 text-xs uppercase text-slate-400">{task.status}</p>
    <div className="mt-3 flex flex-wrap gap-3 text-sm">
      <button onClick={() => tasks.complete.mutate(task._id)}>Complete</button>
      <button onClick={() => tasks.reopen.mutate(task._id)}>Reopen</button>
      <button onClick={() => tasks.archive.mutate(task._id)}>Archive</button>
    </div>
  </li>;

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold sm:text-3xl">Tasks</h1>
    {groups.map(([priority, title]) => <Card key={priority} title={title}><ul className="space-y-2">{items.filter((task) => task.priority === priority && task.status !== 'archived').map(renderTask)}</ul></Card>)}
  </div>;
}
