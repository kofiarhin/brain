import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { GlobalPageLoadingOverlay } from '../components/GlobalPageLoader';
import { useAuth } from '../auth/AuthContext';

const SIDEBAR_STORAGE_KEY = 'brain.sidebarCollapsed';

const icons = {
  dashboard: 'M3 13h8V3H3v10Zm10 8h8V3h-8v18ZM3 21h8v-6H3v6Z',
  notes: 'M6 3h9l5 5v13H6V3Zm8 0v6h6',
  calendar: 'M7 3v4m10-4v4M4 9h16M5 5h14v16H5V5Z',
  tasks: 'M9 11l3 3L22 4M4 7h5M4 14h5M4 21h12',
  projects: 'M3 7h7l2 3h9v9H3V7Z',
  ideas: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2Z',
  context: 'M12 3a9 9 0 1 0 9 9M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9M12 3c-3 3-4 6-4 9s1 6 4 9',
  preferences: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 20 7.1l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.8.8Z',
  reviews: 'M4 5h16M4 12h16M4 19h10',
  reports: 'M4 19V5m5 14v-7m5 7V8m5 11v-4',
  posts: 'M4 4h16v16H4V4Zm4 5h8M8 13h8M8 17h5',
};

const nav = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/notes', label: 'Notes', icon: 'notes' },
  { to: '/day-plan', label: 'Day Plan', icon: 'calendar' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/projects', label: 'Projects', icon: 'projects' },
  { to: '/goals-ideas', label: 'Goals & Ideas', icon: 'ideas' },
  { to: '/context', label: 'Context', icon: 'context' },
  { to: '/preferences', label: 'Preferences', icon: 'preferences' },
  { to: '/reviews', label: 'Reviews', icon: 'reviews' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
  { to: '/generated-posts', label: 'Generated Posts', icon: 'posts' },
];

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={icons[name]} />
    </svg>
  );
}

function Navigation({ collapsed = false, onNavigate }) {
  return <nav className={`mt-6 grid gap-2 ${collapsed ? 'justify-items-center' : ''}`} aria-label="Primary navigation">
    {nav.map(({ to, label, icon }) => <NavLink
      key={to}
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) => `group relative flex min-h-10 items-center rounded-lg text-sm transition-colors ${collapsed ? 'w-10 justify-center px-0' : 'gap-3 px-3 py-2'} ${isActive ? 'bg-accent text-text-inverted' : 'text-text-secondary hover:bg-elevated'}`}
    >
      <Icon name={icon} className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
      {collapsed && <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md border border-border-subtle bg-panel px-2 py-1 text-xs text-text-primary shadow-xl group-hover:block group-focus-visible:block">{label}</span>}
    </NavLink>)}
  </nav>;
}

function Brand({ collapsed = false, onNavigate }) {
  if (collapsed) {
    return <Link to="/" onClick={onNavigate} aria-label="Brain OS home" title="Brain OS" className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-sm font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-app">B</Link>;
  }

  return <Link to="/" onClick={onNavigate} className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-app">
    <h1 className="text-xl font-bold">Brain OS</h1>
    <p className="mt-1 text-sm text-text-muted">MongoDB = Memory / Codex = Brain</p>
  </Link>;
}

function loadCollapsedPreference() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AppLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(loadCollapsedPreference);
  const { logout, username } = useAuth();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
    } catch {
      // Ignore storage failures so navigation still works in restricted browsers.
    }
  }, [isSidebarCollapsed]);

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

  return <div className="min-h-screen bg-app text-text-primary">
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-subtle bg-app/95 px-4 py-3 backdrop-blur md:hidden">
      <Brand />
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen(true)}
        className="rounded-lg border border-border bg-panel px-3 py-2 text-sm font-medium text-text-primary"
      >
        Menu
      </button>
    </header>

    <aside aria-label="Desktop sidebar" className={`no-scrollbar fixed inset-y-0 left-0 z-30 hidden overflow-y-auto border-r border-border-subtle bg-panel/80 p-4 transition-[width] duration-300 ease-in-out md:block ${isSidebarCollapsed ? 'md:w-[72px]' : 'md:w-64'}`}>
      <div className={`flex items-start ${isSidebarCollapsed ? 'flex-col gap-3' : 'justify-between gap-4'}`}>
        <Brand collapsed={isSidebarCollapsed} />
        <button
          type="button"
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isSidebarCollapsed}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setIsSidebarCollapsed((value) => !value)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>
      <Navigation collapsed={isSidebarCollapsed} />
      <div className={`mt-6 border-t border-border-subtle pt-4 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
        {isSidebarCollapsed ? (
          <button type="button" onClick={logout} aria-label="Logout" title={username ? `Logout ${username}` : 'Logout'} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-elevated hover:text-text-primary">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M10 17l5-5-5-5M15 12H3M21 3v18" />
            </svg>
          </button>
        ) : (
          <>
            <p className="text-xs text-text-muted">Signed in as</p>
            <p className="mt-1 text-sm font-medium text-text-secondary">{username}</p>
            <button type="button" onClick={logout} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-elevated">Logout</button>
          </>
        )}
      </div>
    </aside>

    {isMenuOpen && <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close navigation menu"
        className="absolute inset-0 bg-app/70"
        onClick={() => setIsMenuOpen(false)}
      />
      <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-border-subtle bg-panel p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <Brand onNavigate={() => setIsMenuOpen(false)} />
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setIsMenuOpen(false)}
            className="rounded-lg border border-border px-3 py-1 text-sm text-text-secondary"
          >
            Close
          </button>
        </div>
        <Navigation onNavigate={() => setIsMenuOpen(false)} />
        <div className="mt-6 border-t border-border-subtle pt-4">
          <p className="text-xs text-text-muted">Signed in as</p>
          <p className="mt-1 text-sm font-medium text-text-secondary">{username}</p>
          <button type="button" onClick={() => { setIsMenuOpen(false); logout(); }} className="mt-3 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary">Logout</button>
        </div>
      </aside>
    </div>}

    <main className={`relative min-w-0 px-4 py-5 transition-[margin-left] duration-300 ease-in-out sm:px-6 md:p-8 ${isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-64'}`}>
      <Outlet />
      <GlobalPageLoadingOverlay />
    </main>
  </div>;
}
