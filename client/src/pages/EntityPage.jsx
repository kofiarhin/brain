import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';

export function EntityPage({ name, title, fields, statusActions = false }) {
  const resource = useResource(name);
  const [form, setForm] = useState({});
  const submit = async (event) => {
    event.preventDefault();
    await resource.create.mutateAsync(form);
    setForm({});
  };
  return <div className="space-y-4"><h1 className="text-3xl font-bold">{title}</h1><Card title={`New ${title}`}><form onSubmit={submit} className="grid gap-3 md:grid-cols-2">{fields.map(([key, label]) => <input key={key} aria-label={label} placeholder={label} className="rounded-lg border border-slate-700 bg-slate-950 p-3" value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}<button className="rounded-lg bg-blue-600 px-4 py-2">Save</button></form></Card><Card title={`Saved ${title}`}><div className="space-y-3">{resource.data?.map((item) => <article key={item._id} className="rounded-xl bg-slate-800 p-4"><h2 className="font-semibold">{item.title || item.name || item.category}</h2><p className="text-sm text-slate-300">{item.description || item.value}</p><div className="mt-2 flex gap-3 text-sm"><button onClick={() => resource.remove.mutate(item._id)} className="text-red-300">Delete</button>{statusActions && <><button onClick={() => resource.complete.mutate(item._id)}>Complete</button><button onClick={() => resource.reopen.mutate(item._id)}>Reopen</button><button onClick={() => resource.archive.mutate(item._id)}>Archive</button></>}</div></article>)}</div></Card></div>;
}
