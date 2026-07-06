import { useEffect, useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';
import { EntityDetailsModal } from '../components/EntityDetailsModal';

const getTitle = (item, fallback) => item.title || item.name || item.category || fallback;

export function EntityWorkspacePage({ name, title, fields }) {
  const resource = useResource(name);
  const [form, setForm] = useState({});
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

  return <div className="space-y-4">
    <h1 className="break-words text-2xl font-bold sm:text-3xl">{title}</h1>
    <Card title={`New ${title}`}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {fields.map(([key, label]) => <input key={key} aria-label={label} placeholder={label} className="min-w-0 rounded-lg border border-border bg-surface p-3 text-text-primary placeholder:text-text-muted focus:border-accent" value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />)}
        <button className="rounded-lg bg-accent px-4 py-2 font-medium text-text-inverted hover:bg-accent-hover sm:w-fit">Save</button>
      </form>
    </Card>
    <Card title={`Saved ${title}`}>
      <div className="space-y-3">
        {resource.data?.map((item) => <article key={item._id} className="rounded-xl bg-elevated p-4">
          <button type="button" className="block w-full rounded-lg text-left transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-accent" onClick={() => setSelectedItem(item)}>
            <h2 className="break-words font-semibold">{getTitle(item, title)}</h2>
            <p className="mt-1 break-words text-sm text-text-secondary">{item.description || item.value}</p>
          </button>
        </article>)}
      </div>
    </Card>
    {selectedItem && <EntityDetailsModal item={selectedItem} title={title} fields={fields} resource={resource} onClose={() => setSelectedItem(null)} />}
  </div>;
}
