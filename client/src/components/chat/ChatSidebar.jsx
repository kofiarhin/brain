import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const iconPaths = {
  brain: 'M12 3a4 4 0 0 0-4 4v1H7a3 3 0 0 0-1 5.83A3 3 0 0 0 8 19h1a3 3 0 0 0 6 0h1a3 3 0 0 0 2-5.17A3 3 0 0 0 17 8h-1V7a4 4 0 0 0-4-4Zm0 0v18M8 8h4m-5 5h5m4-5h-4m5 5h-5',
  chat: 'M4 5h16v10H7l-3 3V5Z',
  notes: 'M6 3h9l5 5v13H6V3Zm8 0v6h6',
  tasks: 'M9 11l3 3L22 4M4 7h5M4 14h5M4 21h12',
  calendar: 'M7 3v4m10-4v4M4 9h16M5 5h14v16H5V5Z',
  plus: 'M12 5v14M5 12h14',
  logout: 'M10 17l5-5-5-5M15 12H3M21 3v18',
  close: 'M6 6l12 12M18 6 6 18',
};

const navItems = [
  { to: '/chat', label: 'Chat', icon: 'chat' },
  { to: '/notes', label: 'Notes', icon: 'notes' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/day-plan', label: 'Day Plan', icon: 'calendar' },
];

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={iconPaths[name]} />
    </svg>
  );
}

function formatConversationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function getGroupLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Older';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDay = new Date(date);
  itemDay.setHours(0, 0, 0, 0);
  const difference = Math.round((today - itemDay) / 86400000);

  if (difference <= 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  if (difference < 7) return 'Previous 7 days';
  return 'Older';
}

function groupConversations(conversations) {
  const order = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];
  const grouped = new Map(order.map((label) => [label, []]));

  conversations.forEach((conversation) => {
    grouped.get(getGroupLabel(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt)).push(conversation);
  });

  return order.map((label) => ({ label, conversations: grouped.get(label) })).filter((group) => group.conversations.length);
}

function SidebarContent({ conversations, selectedConversationId, onSelectConversation, onNewConversation, onClose }) {
  const { logout, username } = useAuth();
  const groups = groupConversations(conversations);
  const initial = (username || 'A').slice(0, 1).toUpperCase();

  return (
    <>
      <div className="flex h-[88px] items-center justify-between border-b border-border-subtle px-5">
        <Link to="/dashboard" onClick={onClose} className="flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-elevated text-text-primary shadow-[0_0_30px_rgba(124,58,237,0.14)]">
            <Icon name="brain" className="h-6 w-6" />
          </span>
          <span>
            <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              Brain OS
              <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">Pro</span>
            </span>
            <span className="block text-xs text-text-muted">Personal operating system</span>
          </span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close chat navigation" className="rounded-lg p-2 text-text-muted hover:bg-elevated hover:text-text-primary lg:hidden">
            <Icon name="close" />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <nav aria-label="Chat navigation" className="grid gap-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${isActive ? 'border border-violet-400/20 bg-violet-500/10 text-violet-200' : 'border border-transparent text-text-secondary hover:bg-elevated hover:text-text-primary'}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="my-5 border-t border-border-subtle" />

        <div className="mb-3 flex items-center justify-between px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Conversations</p>
          <button type="button" onClick={onNewConversation} aria-label="Start new conversation" className="rounded-lg p-2 text-text-muted transition-colors hover:bg-elevated hover:text-text-primary">
            <Icon name="plus" className="h-4 w-4" />
          </button>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
          {groups.map((group) => (
            <section key={group.label} className="mb-5" aria-labelledby={`conversation-group-${group.label.replaceAll(' ', '-').toLowerCase()}`}>
              <h2 id={`conversation-group-${group.label.replaceAll(' ', '-').toLowerCase()}`} className="mb-2 px-2 text-[11px] font-medium text-text-muted">{group.label}</h2>
              <div className="grid gap-1">
                {group.conversations.map((conversation) => {
                  const active = selectedConversationId === conversation._id;
                  return (
                    <button
                      key={conversation._id}
                      type="button"
                      onClick={() => onSelectConversation(conversation._id)}
                      className={`group flex min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors ${active ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                    >
                      <span className="min-w-0 truncate text-sm">{conversation.title || 'New Chat'}</span>
                      <span className={`shrink-0 text-[10px] ${active ? 'text-violet-300' : 'text-text-muted group-hover:text-text-secondary'}`}>
                        {formatConversationTime(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {!groups.length && (
            <div className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-text-muted">
              No matching conversations.
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border-subtle p-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-sm font-semibold text-black">{initial}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-text-primary">{username || 'admin'}</span>
            <span className="block text-xs text-text-muted">Pro Plan</span>
          </span>
          <button type="button" onClick={logout} aria-label="Log out" title="Log out" className="rounded-lg p-2 text-text-muted hover:bg-elevated hover:text-text-primary">
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </>
  );
}

export function ChatSidebar(props) {
  return (
    <>
      <aside className="hidden h-screen w-[300px] shrink-0 flex-col border-r border-border-subtle bg-panel/85 backdrop-blur-xl lg:flex">
        <SidebarContent {...props} />
      </aside>

      {props.isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close chat navigation" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={props.onClose} />
          <aside className="relative z-10 flex h-full w-[300px] max-w-[88vw] flex-col border-r border-border-subtle bg-panel shadow-2xl">
            <SidebarContent {...props} />
          </aside>
        </div>
      )}
    </>
  );
}
