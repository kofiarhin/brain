import { useEffect, useMemo, useState } from 'react';

const hiddenKeys = new Set(['__v', '_id', 'createdAt', 'updatedAt']);

function formatLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
}

function stringifyValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function buildInitialForm(item, editableKeys) {
  return editableKeys.reduce((form, key) => ({ ...form, [key]: stringifyValue(item[key]) }), {});
}

export function EntityDetailsModal({ item, title, fields = [], resource, onClose }) {
  const heading = item.title || item.name || item.category || title;
  const modalTitle = `${title.replace(/s$/, '')} Details`;
  const fieldKeys = fields.map(([key]) => key);
  const editableKeys = useMemo(() => {
    const keys = fieldKeys.length ? fieldKeys : Object.keys(item).filter((key) => !hiddenKeys.has(key));
    return Array.from(new Set([...keys, 'status'].filter((key) => key in item && !hiddenKeys.has(key))));
  }, [fieldKeys, item]);
  const metaRows = Object.entries(item).filter(([key]) => !editableKeys.includes(key) && key !== '__v');
  const [form, setForm] = useState(() => buildInitialForm(item, editableKeys));
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setForm(buildInitialForm(item, editableKeys));
    setFeedback('');
  }, [item, editableKeys]);

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const saveChanges = async () => {
    if (!item?._id || !resource?.update || resource.update.isPending) return;

    const payload = editableKeys.reduce((nextPayload, key) => {
      nextPayload[key] = form[key] ?? '';
      return nextPayload;
    }, {});

    try {
      setFeedback('Saving...');
      await resource.update.mutateAsync({ id: item._id, payload });
      onClose();
    } catch (error) {
      setFeedback(error?.message ? `Save failed: ${error.message}` : 'Save failed.');
    }
  };

  const deleteItem = async () => {
    if (!item?._id || !resource?.remove || resource.remove.isPending) return;
    const confirmed = window.confirm(`Delete "${heading}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setFeedback('Deleting...');
      await resource.remove.mutateAsync(item._id);
      onClose();
    } catch (error) {
      setFeedback(error?.message ? `Delete failed: ${error.message}` : 'Delete failed.');
    }
  };

  const isSaving = resource?.update?.isPending;
  const isDeleting = resource?.remove?.isPending;
  const hasRequiredTitle = !editableKeys.includes('title') || Boolean(form.title?.trim());

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="entity-modal-title">
    <section className="flex h-[min(80vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-elevated text-text-primary shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-elevated px-4 py-3 sm:px-6">
        <button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface hover:text-text-primary" onClick={onClose}>Back to {title}</button>
        <h2 id="entity-modal-title" className="text-lg font-bold">{modalTitle}</h2>
        <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-2xl leading-none text-text-muted hover:bg-surface hover:text-text-primary" onClick={onClose} aria-label={`Close ${title.toLowerCase()} modal`}>×</button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-border pb-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Editing workspace</p>
            <p className="mt-1 text-sm text-text-muted">Header and actions stay visible while the content scrolls.</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {editableKeys.map((key) => {
            const isLongText = key === 'description' || (form[key] ?? '').length > 120;
            return <label key={key} className="block rounded-xl bg-surface p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{fields.find(([fieldKey]) => fieldKey === key)?.[1] || formatLabel(key)}</span>
              {isLongText ? <textarea className="mt-2 min-h-40 w-full resize-y rounded-lg border border-border bg-elevated p-3 text-sm leading-7 text-text-primary outline-none placeholder:text-text-muted focus:border-accent" value={form[key] ?? ''} onChange={(event) => setValue(key, event.target.value)} /> : <input className="mt-2 w-full rounded-lg border border-border bg-elevated p-3 text-sm leading-7 text-text-primary outline-none placeholder:text-text-muted focus:border-accent" value={form[key] ?? ''} onChange={(event) => setValue(key, event.target.value)} />}
            </label>;
          })}

          {metaRows.map(([key, value]) => <div key={key} className="rounded-xl bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{formatLabel(key)}</p>
            <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-text-secondary">{stringifyValue(value) || '—'}</p>
          </div>)}
        </div>
      </div>

      <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-border bg-elevated px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <button type="button" className="rounded-lg border border-danger/60 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60" onClick={deleteItem} disabled={isDeleting}>Delete</button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {feedback && <span className="text-sm text-text-secondary">{feedback}</span>}
          <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-surface" onClick={onClose}>Cancel</button>
          <button type="button" className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-text-inverted hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60" onClick={saveChanges} disabled={!hasRequiredTitle || isSaving || isDeleting}>Save changes</button>
        </div>
      </footer>
    </section>
  </div>;
}
