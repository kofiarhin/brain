import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';

export function EntityPage({ name, title, fields, statusActions = false, editAction = false, archiveAction = false }) {
  const resource = useResource(name);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const submit = async (event) => {
    event.preventDefault();
    await resource.create.mutateAsync(form);
    setForm({});
  };

  const startEditing = (item) => {
    const draft = {};
    fields.forEach(([key]) => {
      draft[key] = item[key] || '';
    });
    setEditingId(item._id);
    setEditForm(draft);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEditing = async (id) => {
    await resource.update.mutateAsync({ id, payload: editForm });
    cancelEditing();
  };

  return <div className="space-y-4">
    <h1 className="break-words text-2xl font-bold sm:text-3xl">{title}</h1>
    <Card title={`New ${title}`}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {fields.map(([key, label]) => <input key={key} aria-label={label} placeholder={label} className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 p-3" value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
        <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium sm:w-fit">Save</button>
      </form>
    </Card>
    <Card title={`Saved ${title}`}>
      <div className="space-y-3">
        {resource.data?.map((item) => {
          const isEditing = editingId === item._id;

          return <article key={item._id} className="rounded-xl bg-slate-800 p-4">
            {isEditing ? <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(([key, label]) => <label key={key} className="text-sm text-slate-300">
                <span className="mb-1 block text-xs uppercase text-slate-400">{label}</span>
                <input
                  aria-label={`${label} for ${item.title || item.name || item.category || title}`}
                  className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 p-3"
                  value={editForm[key] || ''}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                />
              </label>)}
            </div> : <>
              <h2 className="break-words font-semibold">{item.title || item.name || item.category}</h2>
              <p className="mt-1 break-words text-sm text-slate-300">{item.description || item.value}</p>
            </>}
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {isEditing ? <>
                <button onClick={() => saveEditing(item._id)}>Save</button>
                <button onClick={cancelEditing}>Cancel</button>
              </> : <>
                {editAction && <button onClick={() => startEditing(item)}>Edit</button>}
                {statusActions && <>
                  <button onClick={() => resource.complete.mutate(item._id)}>Complete</button>
                  <button onClick={() => resource.reopen.mutate(item._id)}>Reopen</button>
                  <button onClick={() => resource.archive.mutate(item._id)}>Archive</button>
                </>}
                {!statusActions && archiveAction && <button onClick={() => resource.archive.mutate(item._id)}>Archive</button>}
                <button onClick={() => resource.remove.mutate(item._id)} className="text-red-300">Delete</button>
              </>}
            </div>
          </article>;
        })}
      </div>
    </Card>
  </div>;
}
