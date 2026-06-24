export function List({ items = [] }) {
  if (!items?.length) return <p className="text-sm text-slate-500">Nothing saved yet.</p>;
  return <ul className="space-y-2">{items.map((item, index) => <li className="break-words rounded-lg bg-slate-800 p-3 text-sm leading-relaxed" key={`${item}-${index}`}>{item}</li>)}</ul>;
}
