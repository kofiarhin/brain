import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { GlobalPageLoadingOverlay } from '../components/GlobalPageLoader';
import { useAuth } from '../auth/AuthContext';

const nav = [
  ['/', 'Dashboard'], ['/notes', 'Notes'], ['/day-plan', 'Day Plan'], ['/tasks', 'Tasks'],
  ['/projects', 'Projects'], ['/goals-ideas', 'Goals & Ideas'],
  ['/context', 'Context'], ['/preferences', 'Preferences'], ['/reviews', 'Reviews'], ['/reports', 'Reports'], ['/generated-posts', 'Generated Posts']
];

function Navigation({ onNavigate }) {
  return <nav className="mt-6 grid gap-2">
    {nav.map(([to, label]) => <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{label}</NavLink>)}
  </nav>;
}

function Brand({ onNavigate }) {
  return <Link to="/" onClick={onNavigate} className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900">
    <h1 className="text-xl font-bold">Brain OS</h1>
    <p className="mt-1 text-sm text-slate-400">MongoDB = Memory · Codex = Brain</p>
  </Link>;
}

export function AppLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { logout, username } = useAuth();

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };

    document.body.classList.add('overflow-hidden', 'md:overflow-auto');
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.classList.remove('overflow-hidden', 'md:overflow-auto');
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMenuOpen]);

  return <div className="min-h-screen bg-slate-950 text-slate-100 md:flex">
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:hidden">
      <Brand />
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen(true)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100"
      >
        Menu
      </button>
    </header>

    <aside className="hidden border-r border-slate-800 bg-slate-900/80 p-4 md:block md:min-h-screen md:w-64 md:shrink-0">
      <Brand />
      <Navigation />
      <div className="mt-6 border-t border-slate-800 pt-4">
        <p className="text-xs text-slate-500">Signed in as</p>
        <p className="mt-1 text-sm font-medium text-slate-200">{username}</p>
        <button type="button" onClick={logout} className="mt-3 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">Logout</button>
      </div>
    </aside>

    {isMenuOpen && <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 bg-slate-950/70"
        onClick={() => setIsMenuOpen(false)}
      />
      <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-slate-800 bg-slate-900 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <Brand onNavigate={() => setIsMenuOpen(false)} />
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsMenuOpen(false)}
            className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-200"
          >
            Close
          </button>
        </div>
        <Navigation onNavigate={() => setIsMenuOpen(false)} />
        <div className="mt-6 border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-500">Signed in as</p>
          <p className="mt-1 text-sm font-medium text-slate-200">{username}</p>
          <button type="button" onClick={() => { setIsMenuOpen(false); logout(); }} className="mt-3 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">Logout</button>
        </div>
      </aside>
    </div>}

    <main className="relative min-w-0 flex-1 px-4 py-5 sm:px-6 md:p-8">
      <Outlet />
      <GlobalPageLoadingOverlay />
    </main>
  </div>;
}
