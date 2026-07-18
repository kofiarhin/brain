function itemText(item) {
  if (item === null || item === undefined || item === '') return '';
  if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return String(item);

  if (typeof item === 'object') {
    const primary = item.title || item.activity || item.description || item.label || item.name || item.summary || item.message;
    const secondary = item.time || item.status || item.priority;
    const text = [secondary, primary].filter(Boolean).join(' - ');
    if (text) return text;
  }

  return JSON.stringify(item);
}

export function List({ items = [] }) {
  const normalizedItems = (Array.isArray(items) ? items : [items]).map(itemText).filter(Boolean);
  if (!normalizedItems.length) return <p className="text-sm text-slate-500">Nothing saved yet.</p>;

  return <ul className="space-y-2">
    {normalizedItems.map((item, index) => <li className="break-words rounded-lg bg-slate-800 p-3 text-sm leading-relaxed" key={`${item}-${index}`}>{item}</li>)}
  </ul>;
}
