import React from 'react';

const snippets = [
  'await brain.sync(memory)',
  'codex://focus-mode',
  'vector.search(context)',
  'neural.link(task)',
  'priority = signal/noise',
  'SYSTEM: ONLINE',
  'memory.write(dayPlan)',
  'ops.replan(now)',
  'encrypt.thoughts()',
  'session.restore()',
];

export function CodeRain() {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-45" aria-hidden="true">
    {snippets.map((snippet, index) => (
      <span
        key={snippet}
        className="landing-code-rain absolute whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.28em] text-sky-200/35"
        style={{
          left: `${8 + ((index * 11) % 86)}%`,
          animationDelay: `${index * -2.7}s`,
          animationDuration: `${16 + (index % 5) * 3}s`,
        }}
      >
        {snippet}
      </span>
    ))}
  </div>;
}
