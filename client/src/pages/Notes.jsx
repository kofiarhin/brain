import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useResource } from '../hooks/useResource';
import { Card } from '../components/Card';

function AutoResizeTextarea({ value, onChange, className = '', ...props }) {
  const textareaRef = useRef(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return <textarea ref={textareaRef} className={`resize-none overflow-hidden ${className}`} value={value} onChange={onChange} {...props} />;
}

export function Notes() {
  const [content, setContent] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [modalContent, setModalContent] = useState('');
  const [copyStatus, setCopyStatus] = useState('idle');
  const notes = useResource('notes');
  const selectedNoteId = selectedNote?._id;

  useEffect(() => {
    if (!selectedNoteId) return;

    const currentNote = notes.data?.find((note) => note._id === selectedNoteId);
    if (!currentNote) {
      setSelectedNote(null);
      setModalContent('');
      setCopyStatus('idle');
      return;
    }

    setSelectedNote(currentNote);
  }, [notes.data, selectedNoteId]);

  useEffect(() => {
    if (copyStatus !== 'copied') return undefined;

    const timeoutId = window.setTimeout(() => setCopyStatus('idle'), 1600);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const save = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    await notes.create.mutateAsync({ content });
    setContent('');
  };

  const openNote = (note) => {
    setSelectedNote(note);
    setModalContent(note.content);
    setCopyStatus('idle');
  };

  const closeNote = () => {
    setSelectedNote(null);
    setModalContent('');
    setCopyStatus('idle');
  };

  const copyNote = async () => {
    if (!modalContent) return;

    try {
      await navigator.clipboard.writeText(modalContent);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
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
        <AutoResizeTextarea aria-label="Note content" className="min-h-32 w-full rounded-xl border border-border bg-surface p-3 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent sm:text-base" value={content} onChange={(e) => setContent(e.target.value)} />
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

    {selectedNote && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="note-modal-title">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-elevated p-4 text-text-primary shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 id="note-modal-title" className="text-xl font-bold">Note Details</h2>
            <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted transition hover:bg-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50" onClick={copyNote} disabled={!modalContent} aria-label="Copy note text" title={copyStatus === 'copied' ? 'Copied' : 'Copy note text'}>
              {copyStatus === 'copied' ? <span aria-hidden="true" className="text-sm font-bold">OK</span> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="10" height="10" rx="2" />
                <path d="M5 15V7a2 2 0 0 1 2-2h8" />
              </svg>}
            </button>
            {copyStatus === 'failed' && <span className="text-xs text-danger">Copy failed</span>}
          </div>
          <button type="button" className="rounded-lg px-3 py-1 text-text-muted hover:bg-surface" onClick={closeNote} aria-label="Close note modal">&times;</button>
        </div>

        <AutoResizeTextarea aria-label="Edit selected note" className="min-h-80 w-full rounded-xl border border-border bg-surface p-3 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-accent sm:text-base" value={modalContent} onChange={(e) => setModalContent(e.target.value)} autoFocus />

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="rounded-lg px-4 py-2 text-sm font-medium text-danger hover:bg-surface" onClick={deleteNote} disabled={notes.remove.isPending}>Delete</button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface" onClick={closeNote}>Cancel</button>
            <button type="button" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-text-inverted hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60" onClick={saveChanges} disabled={!modalContent.trim() || notes.update.isPending}>Save changes</button>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}
