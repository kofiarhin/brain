import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';

export function Notes() {
  const [content, setContent] = useState('');
  const notes = useResource('notes');
  const save = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    await notes.create.mutateAsync({ content });
    setContent('');
  };

  return <div className="space-y-6">
    <h1 className="text-2xl font-bold sm:text-3xl">Notes</h1>
    <Card title="Capture">
      <form onSubmit={save} className="space-y-3">
        <textarea aria-label="Note content" className="min-h-32 w-full rounded-xl border border-border bg-surface p-3 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent sm:text-base" value={content} onChange={(e) => setContent(e.target.value)} />
        <button className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-text-inverted hover:bg-accent-hover sm:w-auto">Save note</button>
      </form>
    </Card>
    <Card title="Saved Notes">
      <div className="space-y-3">
        {notes.data?.map((note) => <article key={note._id} className="rounded-xl bg-elevated p-3 sm:p-4">
          <textarea aria-label={`Edit note ${note._id}`} className="w-full rounded border border-border bg-surface p-3 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent sm:text-base" defaultValue={note.content} onBlur={(e) => notes.update.mutate({ id: note._id, payload: { content: e.target.value } })} />
          <button className="mt-2 text-sm text-danger" onClick={() => notes.remove.mutate(note._id)}>Delete</button>
        </article>)}
      </div>
    </Card>
  </div>;
}
