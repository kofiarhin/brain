import React from 'react';

function BrainAvatar() {
  return (
    <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-400/25 bg-violet-500/10 text-violet-300 shadow-[0_0_24px_rgba(139,92,246,0.14)]" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 3a4 4 0 0 0-4 4v1H7a3 3 0 0 0-1 5.83A3 3 0 0 0 8 19h1a3 3 0 0 0 6 0h1a3 3 0 0 0 2-5.17A3 3 0 0 0 17 8h-1V7a4 4 0 0 0-4-4Zm0 0v18M8 8h4m-5 5h5m4-5h-4m5 5h-5" />
      </svg>
    </span>
  );
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function ContextUsed({ contextUsed, retrieval }) {
  const entries = Object.entries(contextUsed || {}).filter(([, count]) => Number(count) > 0);
  const retrievalLabel = retrieval?.degraded
    ? 'Degraded retrieval'
    : retrieval?.mode && retrieval.mode !== 'none'
      ? `${retrieval.mode} retrieval`
      : '';

  if (!entries.length && !retrievalLabel) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-3 text-[11px] text-text-muted">
      {entries.map(([key, count]) => (
        <span key={key} className="rounded-full border border-border-subtle bg-app/40 px-2.5 py-1">{key}: {count}</span>
      ))}
      {retrievalLabel && (
        <span className={`rounded-full border px-2.5 py-1 ${retrieval?.degraded ? 'border-warning/30 bg-warning-soft/20 text-warning' : 'border-violet-400/20 bg-violet-500/10 text-violet-300'}`}>
          {retrievalLabel}
        </span>
      )}
    </div>
  );
}

export function MessageBubble({ message }) {
  const assistant = message.role === 'assistant';

  if (!assistant) {
    return (
      <div className="flex justify-end pl-10 sm:pl-24">
        <article className={`max-w-2xl rounded-[22px] rounded-br-md border border-border-subtle bg-elevated px-5 py-3.5 text-sm leading-6 text-text-primary shadow-lg ${message.pending ? 'opacity-65' : ''}`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
          <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-text-muted">
            <span>{formatTime(message.createdAt)}</span>
            {message.pending ? <span>Sending…</span> : <span aria-label="Delivered">✓✓</span>}
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 pr-4 sm:pr-20">
      <BrainAvatar />
      <article className="max-w-3xl rounded-[22px] rounded-tl-md border border-border-subtle bg-panel/90 px-5 py-4 text-sm leading-6 text-text-secondary shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <p className="whitespace-pre-wrap text-text-primary">{message.content}</p>
        <ContextUsed contextUsed={message.contextUsed} retrieval={message.retrieval} />
        <p className="mt-2 text-[10px] text-text-muted">{formatTime(message.createdAt)}</p>
      </article>
    </div>
  );
}

export function ThinkingBubble() {
  return (
    <div className="flex items-start gap-3" aria-live="polite">
      <BrainAvatar />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-border-subtle bg-panel px-4 py-3" aria-label="Brain OS is thinking">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
