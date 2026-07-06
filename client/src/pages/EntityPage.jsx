import { useEffect, useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';

const getItemTitle = (item, fallback) => item.title || item.name || item.category || fallback;

const formatLabel = (key) => key
  .replace(/^_/, '')
  .replace(/([A-Z])/g, ' $1')
  .replace(/[-_]/g, ' ')
  .replace(/^./, (character) => character.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

export function EntityPage({ name, title, fields, statusActions = false, editAction = false, archiveAction = false }) {
  const resource = useResource(name);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (!selectedItem) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedItem(null);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedItem]);

  const submit = async (event) => {
    event.preventDefault();
    await resource.create.mutateAsync(form);
    setForm({});
  };

  const startEditing = (event, item) => {
    event.stopPropagation();
    const draft = {};
    fields.forEach(([key]) => {
      draft[key] = item[key] || '';
    });
    setEditingId(item._id);
    setEditForm(draft);
  };

  const cancelEditing = (event) => {
    event?.stopPropagation();
    setEditingId(null);
    setEditForm({});
  };

  const saveEditing = async (event, id) => {
    event.stopPropagation();
    await resource.update.mutateAsync({ id, payload: editForm });
    cancelEditing();
  };

  const runAction = (event, action, id) => {
    event.stopPropagation();
    action.mutate(id);
  };

  const deleteItem = (event, id) => {
    event.stopPropagation();
    resource.remove.mutate(id);
  };

  const details = selectedItem ? Object.entries(selectedItem).filter(([key]) => key !== '__v') : [];

  return <div className="space-y-4">
    <h1 className="break-words text-2xl font-bold sm:text-3xl">{title}</h1>
    <Card title={`New ${title}`}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {fields.map(([key, label]) => <input key={key} aria-label={label} placeholder={label} className="min-w-0 rounded-lg border border-border bg-surface p-3 text-text-primary placeholder:text-text-muted focus:border-accent" value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
        <button className="rounded-lg bg-accent px-4 py-2 font-medium text-text-inverted hover:bg-accent-hover sm:w-fit">Save</button>
      </form>
    </Card>
    <Card title={`Saved ${title}`}>
      <div className="space-y-3">
        {resource.data?.map((item) => {
          const isEditing = editingId === item._id;
          const itemTitle = getItemTitle(item, title);

          return <article
            key={item._id}
            className={`rounded-xl bg-elevated p-4 ${isEditing ? '' : 'cursor-pointer transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent'}`}
            role={isEditing ? undefined : 'button'}
            tabIndex={isEditing ? undefined : 0}
            onClick={() => !isEditing && setSelectedItem(item)}
            onKeyDown={(event) => {
              if (!isEditing && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                setSelectedItem(item);
              }
            }}
          >
            {isEditing ? <div className="grid gap-3 sm:grid-cols-2" onClick={(event) => event.stopPropagation()}>
              {fields.map(([key, label]) => <label key={key} className="text-sm text-text-secondary">
                <span className="mb-1 block text-xs uppercase text-text-muted">{label}</span>
                <input
                  aria-label={`${label} for ${itemTitle}`}
                  className="w-full min-w-0 rounded-lg border border-border bg-surface p-3 text-text-primary placeholder:text-text-muted focus:border-accent"
                  value={editForm[key] || ''}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                />
              </label>)}
            </div> : <>
              <h2 className="break-words font-semibold">{itemTitle}</h2>
              <p className="mt-1 break-words text-sm text-text-secondary">{item.description || item.value}</p>
            </>}
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {isEditing ? <>
                <button className="rounded-lg bg-accent px-3 py-1.5 font-medium text-text-inverted hover:bg-accent-hover" onClick={(event) => saveEditing(event, item._id)}>Save</button>
                <button className="rounded-lg border border-border px-3 py-1.5 text-text-secondary hover:bg-accent-soft" onClick={cancelEditing}>Cancel</button>
              </> : <>
                {editAction && <button className="rounded-lg border border-border px-3 py-1.5 text-text-secondary hover:bg-accent-soft" onClick={(event) => startEditing(event, item)}>Edit</button>}
                {statusActions && <>
                  <button className="rounded-lg border border-border px-3 py-1.5 text-text-secondary hover:bg-accent-soft" onClick={(event) => runAction(event, resource.complete, item._id)}>Complete</button>
                  <button className="rounded-lg border border-border px-3 py-1.5 text-text-secondary hover:bg-accent-soft" onClick={(event) => runAction(event, resource.reopen, item._id)}>Reopen</button>
                  <button className="rounded-lg border border-border px-3 py-1.5 text-text-secondary hover:bg-accent-soft" onClick={(event) => runAction(event, resource.archive, item._id)}>Archive</button>
                </>}
                {!statusActions && archiveAction && <button className="rounded-lg border border-border px-3 py-1.5 text-text-secondary hover:bg-accent-soft" onClick={(event) => runAction(event, resource.archive, item._id)}>Archive</button>}
                <button onClick={(event) => deleteItem(event, item._id)} className="text-danger">Delete</button>
              </>}
            </div>
          </article>;
        })}
      </div>
    </Card>

    {selectedItem && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 sm:py-12" onClick={() => setSelectedItem(null)}>
      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="entity-details-title"
        className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-muted">{title} details</p>
            <h2 id="entity-details-title" className="mt-1 break-words text-lg font-bold text-text-primary sm:text-xl">{getItemTitle(selectedItem, title)}</h2>
          </div>
          <button type="button" className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-accent-soft" onClick={() => setSelectedItem(null)}>Close</button>
        </header>
        <dl className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4 text-sm">
          {details.map(([key, value]) => <div key={key} className="rounded-xl bg-elevated p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{formatLabel(key)}</dt>
            <dd className="mt-1.5 whitespace-pre-wrap break-words leading-relaxed text-text-secondary">{formatValue(value)}</dd>
          </div>)}
        </dl>
      </section>
    </div>}
  </div>;
}
