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
    <h1 className="text-3xl font-bold">Notes</h1>
    <Card title="Capture"><form onSubmit={save} className="space-y-3"><textarea aria-label="Note content" className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" value={content} onChange={(e) => setContent(e.target.value)} /><button className="rounded-lg bg-blue-600 px-4 py-2 font-medium">Save note</button></form></Card>
    <Card title="Saved Notes"><div className="space-y-3">{notes.data?.map((note) => <article key={note._id} className="rounded-xl bg-slate-800 p-4"><textarea aria-label={`Edit note ${note._id}`} className="w-full rounded bg-slate-950 p-2" defaultValue={note.content} onBlur={(e) => notes.update.mutate({ id: note._id, payload: { content: e.target.value } })} /><button className="mt-2 text-sm text-red-300" onClick={() => notes.remove.mutate(note._id)}>Delete</button></article>)}</div></Card>
  </div>;
}
