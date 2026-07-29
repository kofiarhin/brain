import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listChatConversations, listChatMessages, sendChatMessage } from '../api/chat';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatComposer } from '../components/chat/ChatComposer';
import { MessageBubble, ThinkingBubble } from '../components/chat/MessageBubble';

function messageIdentity(message) {
  return String(message?._id || message?.id || `${message?.role}-${message?.createdAt}-${message?.content}`);
}

function mergeMessages(current, incoming) {
  const messages = new Map();
  [...(Array.isArray(current) ? current : []), ...incoming].forEach((message) => {
    messages.set(messageIdentity(message), message);
  });

  return [...messages.values()].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

export function Chat() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [input, setInput] = useState('');
  const [pendingUserMessage, setPendingUserMessage] = useState(null);
  const [conversationSearch, setConversationSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const searchRef = useRef(null);

  const conversationsQuery = useQuery({
    queryKey: ['chatConversations'],
    queryFn: listChatConversations,
  });

  const messagesQuery = useQuery({
    queryKey: ['chatMessages', selectedConversationId],
    queryFn: () => listChatMessages(selectedConversationId),
    enabled: Boolean(selectedConversationId),
    staleTime: 15000,
  });

  const mutation = useMutation({
    mutationFn: sendChatMessage,
    onSuccess: (data, variables) => {
      const conversationId = data.conversationId;
      const userMessage = data.userMessage || {
        _id: `local-user-${Date.now()}`,
        role: 'user',
        content: variables.message,
        createdAt: new Date().toISOString(),
      };
      const assistantMessage = {
        ...data.message,
        contextUsed: data.message?.contextUsed || data.contextUsed,
        retrieval: data.message?.retrieval || data.retrieval,
      };

      queryClient.setQueryData(
        ['chatMessages', conversationId],
        (current) => mergeMessages(current, [userMessage, assistantMessage]),
      );
      setSelectedConversationId(conversationId);
      setPendingUserMessage(null);
      setInput('');
      queryClient.invalidateQueries({ queryKey: ['chatConversations'] });
    },
    onError: () => {
      setPendingUserMessage(null);
    },
  });

  const conversations = conversationsQuery.data || [];
  const selectedConversation = conversations.find((conversation) => conversation._id === selectedConversationId);
  const filteredConversations = useMemo(() => {
    const search = conversationSearch.trim().toLowerCase();
    if (!search) return conversations;
    return conversations.filter((conversation) => (conversation.title || 'New Chat').toLowerCase().includes(search));
  }, [conversationSearch, conversations]);

  const messages = useMemo(() => {
    const persisted = Array.isArray(messagesQuery.data) ? messagesQuery.data : [];
    return pendingUserMessage ? mergeMessages(persisted, [pendingUserMessage]) : persisted;
  }, [messagesQuery.data, pendingUserMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, mutation.isPending]);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const submit = (value = input) => {
    const message = String(value || '').trim();
    if (!message || mutation.isPending) return;

    setPendingUserMessage({
      _id: `pending-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
      pending: true,
    });
    mutation.mutate({ message, conversationId: selectedConversationId });
  };

  const selectConversation = (conversationId) => {
    if (mutation.isPending) return;
    setSelectedConversationId(conversationId);
    setPendingUserMessage(null);
    mutation.reset();
    setIsSidebarOpen(false);
  };

  const startNewConversation = () => {
    if (mutation.isPending) return;
    setSelectedConversationId(null);
    setPendingUserMessage(null);
    setInput('');
    mutation.reset();
    setIsSidebarOpen(false);
  };

  return (
    <div className="chat-backdrop flex h-screen overflow-hidden bg-app text-text-primary">
      <ChatSidebar
        conversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={selectConversation}
        onNewConversation={startNewConversation}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[88px] shrink-0 items-center gap-3 border-b border-border-subtle bg-app/75 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open chat navigation"
            className="rounded-xl border border-border-subtle bg-panel p-2.5 text-text-secondary hover:bg-elevated hover:text-text-primary lg:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{selectedConversation?.title || 'Chat'}</h1>
            <p className="hidden text-xs text-text-muted sm:block">Read-only answers grounded in your saved Brain context</p>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            <label className="relative hidden min-w-0 sm:block sm:w-[min(36vw,380px)]">
              <span className="sr-only">Search conversations</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Search chats…"
                className="h-11 w-full rounded-xl border border-border-subtle bg-panel/70 pl-10 pr-14 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-violet-400/40"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border-subtle bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">⌘K</span>
            </label>
            <span className="hidden rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-300 md:inline-flex">Read-only</span>
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8" aria-label="Conversation messages">
          <div className="mx-auto flex min-h-full max-w-5xl flex-col">
            {messagesQuery.isLoading && (
              <div className="flex flex-1 items-center justify-center text-sm text-text-muted">Loading conversation…</div>
            )}

            {messagesQuery.isError && (
              <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger-soft/20 p-4 text-sm text-danger">
                {messagesQuery.error?.message || 'Unable to load this conversation.'}
              </div>
            )}

            {!messages.length && !messagesQuery.isLoading && (
              <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-300 shadow-[0_0_50px_rgba(139,92,246,0.14)]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                    <path d="M12 3a4 4 0 0 0-4 4v1H7a3 3 0 0 0-1 5.83A3 3 0 0 0 8 19h1a3 3 0 0 0 6 0h1a3 3 0 0 0 2-5.17A3 3 0 0 0 17 8h-1V7a4 4 0 0 0-4-4Zm0 0v18M8 8h4m-5 5h5m4-5h-4m5 5h-5" />
                  </svg>
                </span>
                <h2 className="text-2xl font-semibold tracking-tight">Start a Brain OS chat</h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-text-secondary">Ask about your notes, projects, goals, tasks, day plans and recent updates. Chat can read your Brain data but cannot change it.</p>
              </div>
            )}

            {!!messages.length && (
              <div className="space-y-5">
                {messages.map((message) => (
                  <MessageBubble key={messageIdentity(message)} message={message} />
                ))}
                {mutation.isPending && <ThinkingBubble />}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </section>

        {(mutation.isError || mutation.error) && (
          <div role="alert" className="mx-4 mb-2 rounded-xl border border-danger/30 bg-danger-soft/20 px-4 py-3 text-sm text-danger sm:mx-6">
            {mutation.error?.message || 'Chat request failed. Your draft is still available.'}
          </div>
        )}

        <ChatComposer
          input={input}
          onInputChange={setInput}
          onSubmit={submit}
          isPending={mutation.isPending}
        />
      </main>
    </div>
  );
}
