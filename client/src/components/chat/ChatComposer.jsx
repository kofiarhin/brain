import React from 'react';

const defaultSuggestions = [
  'Summarize my notes',
  'Plan my day',
  'Find tasks from last week',
];

export function ChatComposer({ input, onInputChange, onSubmit, isPending, suggestions = defaultSuggestions }) {
  const submit = () => onSubmit(input);

  return (
    <div className="border-t border-border-subtle bg-app/90 px-4 pb-4 pt-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSubmit(suggestion)}
              disabled={isPending}
              className="shrink-0 rounded-full border border-border-subtle bg-panel/70 px-3.5 py-2 text-xs text-text-secondary transition-colors hover:border-border hover:bg-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-3 rounded-[22px] border border-border bg-panel/85 p-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-colors focus-within:border-violet-400/45">
          <textarea
            aria-label="Message"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Ask Brain OS anything…"
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim() || isPending}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white shadow-[0_0_28px_rgba(139,92,246,0.36)] transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-muted disabled:shadow-none"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="m22 2-7 20-4-9-9-4 20-7Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-text-muted">Brain OS can make mistakes. Check important information.</p>
      </div>
    </div>
  );
}
