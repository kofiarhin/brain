export function EntityDetailsModal({ item, title, onClose }) {
  const rows = Object.entries(item).filter(([key]) => key !== '__v');
  const heading = item.title || item.name || item.category || title;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6">
    <section className="flex h-[min(80vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface text-text-primary shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:bg-elevated hover:text-text-primary" onClick={onClose}>Back to {title}</button>
        <div className="min-w-0 text-center">
          <p className="text-xs uppercase tracking-wide text-text-muted">{title} details</p>
          <h2 className="mt-1 truncate text-lg font-bold text-text-primary sm:text-xl">{heading}</h2>
        </div>
        <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-xl text-text-muted hover:bg-elevated hover:text-text-primary" onClick={onClose}>Close</button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
        <div className="mb-5 border-b border-border pb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Detail workspace</p>
          <p className="mt-1 text-sm text-text-muted">Header and actions stay visible while long content scrolls.</p>
        </div>

        <dl className="space-y-3 text-sm">
          {rows.map(([key, value]) => <div key={key} className="rounded-xl bg-elevated p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{key}</dt>
            <dd className="mt-2 whitespace-pre-wrap break-words leading-7 text-text-secondary">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '—')}</dd>
          </div>)}
        </dl>
      </div>

      <footer className="flex shrink-0 justify-end border-t border-border bg-surface px-4 py-4 sm:px-6">
        <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-elevated hover:text-text-primary" onClick={onClose}>Close</button>
      </footer>
    </section>
  </div>;
}
