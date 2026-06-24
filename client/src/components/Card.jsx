export function Card({ title, children }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl sm:p-5">
    {title && <h2 className="mb-3 break-words text-base font-semibold sm:text-lg">{title}</h2>}
    <div className="min-w-0 break-words">{children}</div>
  </section>;
}
