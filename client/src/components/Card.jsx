export function Card({ title, children, className = '' }) {
  return <section className={`rounded-2xl border border-border-subtle bg-panel p-4 shadow-xl sm:p-5 ${className}`}>
    {title && <h2 className="mb-3 break-words text-base font-semibold sm:text-lg">{title}</h2>}
    <div className="min-w-0 break-words">{children}</div>
  </section>;
}
