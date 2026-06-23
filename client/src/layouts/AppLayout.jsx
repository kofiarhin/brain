import { NavLink, Outlet } from 'react-router-dom';

const nav = [
  ['/', 'Dashboard'], ['/notes', 'Notes'], ['/day-plan', 'Day Plan'], ['/tasks', 'Tasks'],
  ['/deliverables', 'Deliverables'], ['/projects', 'Projects'], ['/goals-ideas', 'Goals & Ideas'],
  ['/context', 'Context'], ['/reviews', 'Reviews']
];

export function AppLayout() {
  return <div className="min-h-screen md:flex">
    <aside className="border-b border-slate-800 bg-slate-900/80 p-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <h1 className="text-xl font-bold">Brain OS</h1>
      <p className="mt-1 text-sm text-slate-400">MongoDB = Memory · Codex = Brain</p>
      <nav className="mt-6 grid gap-2">
        {nav.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{label}</NavLink>)}
      </nav>
    </aside>
    <main className="flex-1 p-4 md:p-8"><Outlet /></main>
  </div>;
}
