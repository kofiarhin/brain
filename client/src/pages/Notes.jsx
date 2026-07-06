import { useEffect, useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';

export function Notes() {
  const [content, setContent] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [modalContent, setModalContent] = useState('');
  const notes = useResource('notes');

  useEffect(() => {
    if (!selectedNote) return;

    const currentNote = notes.data?.find((note) => note._id === selectedNote._id);
    if (!currentNote) {
      setSelectedNote(null);
      setModalContent('');
      return;
    }

    setSelectedNote(currentNote);
  }, [notes.data, selectedNote]);

  const save = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    await notes.create.mutateAsync({ content });
    setContent('');
  };

  const openNote = (note) => {
    setSelectedNote(note);
    setModalContent(note.content);
  };

  const closeNote = () => {
    setSelectedNote(null);
    setModalContent('');
  };

  const saveChanges = async () => {
    if (!selectedNote || !modalContent.trim()) return;

    await notes.update.mutateAsync({
      id: selectedNote._id,
      payload: { content: modalContent }
    });
    closeNote();
  };

  const deleteNote = async () => {
    if (!selectedNote) return;

    await notes.remove.mutateAsync(selectedNote._id);
    closeNote();
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
          <button type="button" className="block w-full rounded border border-border bg-surface p-3 text-left text-sm leading-relaxed text-text-primary transition hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent sm:text-base" onClick={() => openNote(note)}>
            <span className="line-clamp-6 whitespace-pre-wrap">{note.content}</span>
          </button>
        </article>)}
      </div>
    </Card>

    {selectedNote && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="note-modal-title">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="note-modal-title" className="text-xl font-bold">Note Details</h2>
          <button type="button" className="rounded-lg px-3 py-1 text-slate-300 hover:bg-slate-800" onClick={closeNote} aria-label="Close note modal">&times;</button>
        </div>

        <textarea aria-label="Edit selected note" className="min-h-80 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-relaxed sm:text-base" value={modalContent} onChange={(e) => setModalContent(e.target.value)} autoFocus />

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40" onClick={deleteNote} disabled={notes.remove.isPending}>Delete</button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800" onClick={closeNote}>Cancel</button>
            <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60" onClick={saveChanges} disabled={!modalContent.trim() || notes.update.isPending}>Save changes</button>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}
