export function Card({ title, children }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
    {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
    {children}
  </section>;
}
