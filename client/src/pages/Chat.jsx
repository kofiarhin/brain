import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listChatConversations, listChatMessages, sendChatMessage } from '../api/chat';

const suggestions = [
  'What should I focus on today?',
  'Summarize my active projects.',
  'What tasks are blocking my goals?',
  'What should I do next for Brain App?',
  'Show me my highest priority work.',
];

function ContextUsed({ contextUsed }) {
  if (!contextUsed || !Object.keys(contextUsed).length) return null;
  return <div className="mt-3 rounded-lg border border-border-subtle bg-app/50 p-3 text-xs text-text-muted">
    <p className="mb-2 font-medium text-text-secondary">Context used</p>
    <div className="flex flex-wrap gap-2">{Object.entries(contextUsed).filter(([, count]) => count > 0).map(([key, count]) => <span key={key} className="rounded-full border border-border px-2 py-1">{key}: {count}</span>)}</div>
  </div>;
}

function MessageBubble({ message }) {
  const assistant = message.role === 'assistant';
  return <div className={`flex ${assistant ? 'justify-start' : 'justify-end'}`}>
    <div className={`max-w-3xl whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${assistant ? 'border border-border-subtle bg-panel text-text-primary' : 'bg-accent text-text-inverted'}`}>
      {message.content}
      {assistant && <ContextUsed contextUsed={message.contextUsed} />}
    </div>
  </div>;
}

export function Chat() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState([]);
  const messagesEndRef = useRef(null);

  const conversationsQuery = useQuery({ queryKey: ['chatConversations'], queryFn: listChatConversations });
  const messagesQuery = useQuery({ queryKey: ['chatMessages', selectedConversationId], queryFn: () => listChatMessages(selectedConversationId), enabled: Boolean(selectedConversationId) });

  useEffect(() => { messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [messagesQuery.data, localMessages]);
  const mutation = useMutation({
    mutationFn: sendChatMessage,
    onSuccess: (data) => {
      setSelectedConversationId(data.conversationId);
      setInput('');
      setLocalMessages((items) => [...items.filter((m) => !m.pending), { ...data.message, contextUsed: data.contextUsed }]);
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
      queryClient.invalidateQueries({ queryKey: ['chatMessages', data.conversationId] });
    },
  });

  const submit = (value = input) => {
    const message = value.trim();
    if (!message || mutation.isPending) return;
    setLocalMessages((items) => [...items, { role: 'user', content: message, createdAt: new Date().toISOString(), pending: true }]);
    mutation.mutate({ message, conversationId: selectedConversationId });
  };

  const messages = selectedConversationId ? [...(messagesQuery.data || []), ...localMessages] : localMessages;

  return <section className="space-y-6">
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-3xl font-bold">Chat</h2><p className="mt-1 text-text-secondary">Ask Brain App about your saved data.</p></div>
      <p className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-muted">Read-only mode</p>
    </header>
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-2xl border border-border-subtle bg-panel p-4">
        <button type="button" onClick={() => { setSelectedConversationId(null); setLocalMessages([]); }} className="mb-4 w-full rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-elevated">New chat</button>
        <div className="space-y-2">
          {(conversationsQuery.data || []).map((conversation) => <button key={conversation._id} type="button" onClick={() => { setSelectedConversationId(conversation._id); setLocalMessages([]); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedConversationId === conversation._id ? 'bg-accent text-text-inverted' : 'bg-elevated text-text-secondary hover:text-text-primary'}`}>{conversation.title || 'New Chat'}</button>)}
          {!conversationsQuery.isLoading && !(conversationsQuery.data || []).length && <p className="text-sm text-text-muted">No conversations yet.</p>}
        </div>
      </aside>
      <div className="flex min-h-[70vh] flex-col rounded-2xl border border-border-subtle bg-panel">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messagesQuery.isLoading && <p className="text-sm text-text-muted">Loading conversation…</p>}
          {!messages.length && !messagesQuery.isLoading && <div className="flex h-full flex-col items-center justify-center text-center"><h3 className="text-xl font-semibold">Start a Brain App chat</h3><p className="mt-2 max-w-md text-text-secondary">Ask about tasks, projects, goals, notes, day plans, and recent Brain updates.</p></div>}
          {messages.map((message, index) => <MessageBubble key={message._id || `${message.role}-${index}`} message={message} />)}
          {mutation.isPending && <p className="text-sm text-text-muted">Brain App is thinking…</p>}
          <div ref={messagesEndRef} />
        </div>
        {mutation.isError && <div role="alert" className="mx-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{mutation.error?.message || 'Chat request failed. Your draft is still here.'}</div>}
        <div className="border-t border-border-subtle p-4">
          <div className="mb-3 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setInput(suggestion); submit(suggestion); }} disabled={mutation.isPending} className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary hover:bg-elevated disabled:opacity-50">{suggestion}</button>)}</div>
          <div className="flex gap-3">
            <textarea aria-label="Message" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Ask Brain App…" className="min-h-20 flex-1 rounded-xl border border-border bg-app px-4 py-3 text-sm text-text-primary outline-none focus:border-accent" />
            <button type="button" onClick={() => submit()} disabled={!input.trim() || mutation.isPending} className="self-end rounded-xl bg-accent px-5 py-3 text-sm font-medium text-text-inverted disabled:opacity-50">Send</button>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
