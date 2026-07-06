export function EntityDetailsModal({ item, title, onClose }) {
  const rows = Object.entries(item).filter(([key]) => key !== '__v');
  const heading = item.title || item.name || item.category || title;
  const modalTitle = `${title.replace(/s$/, '')} Details`;

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
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Detail workspace</p>
            <p className="mt-1 text-sm text-text-muted">Header and actions stay visible while the content scrolls.</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Title</p>
            <p className="mt-2 break-words text-base font-semibold leading-7 text-text-primary">{heading}</p>
          </div>

          {rows.map(([key, value]) => <div key={key} className="rounded-xl bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{key}</p>
            <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-text-secondary">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '—')}</p>
          </div>)}
        </div>
      </div>

      <footer className="flex shrink-0 justify-end border-t border-border bg-elevated px-4 py-4 sm:px-6">
        <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-surface" onClick={onClose}>Close</button>
      </footer>
    </section>
  </div>;
}
