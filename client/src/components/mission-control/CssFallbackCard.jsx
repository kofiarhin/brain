export function CssFallbackCard({ title, subtitle, children }) {
  return <div className="relative min-h-[18rem] overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-5 shadow-2xl">
    <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
    <div className="relative z-10">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{title}</p>
      {subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  </div>;
}
