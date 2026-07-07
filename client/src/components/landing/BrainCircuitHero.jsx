import React from 'react';

const nodes = [
  [205, 168], [258, 118], [320, 142], [398, 105], [482, 148], [548, 118], [615, 170],
  [212, 255], [292, 230], [365, 278], [442, 225], [520, 282], [600, 245],
  [250, 360], [340, 382], [458, 362], [555, 355],
];

const sparks = [
  'M110 230 C160 198 194 188 238 205 C290 226 306 178 362 190',
  'M668 230 C615 198 584 188 540 205 C492 224 470 180 418 194',
  'M180 132 C226 92 286 102 322 142 C360 184 407 96 470 118',
  'M604 126 C552 95 505 102 468 145 C428 192 381 104 316 122',
  'M185 405 C250 356 310 378 366 424 C428 472 493 374 592 416',
];

function HudPanel({ side = 'left', title, children, className = '' }) {
  return <aside className={`pointer-events-none hidden rounded-2xl border border-sky-300/20 bg-black/45 p-4 shadow-[0_0_40px_rgba(14,165,233,0.12)] backdrop-blur-xl lg:block ${className}`}>
    <div className="flex items-center justify-between border-b border-sky-300/10 pb-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.26em] text-sky-100">{title}</p>
      <span className="h-px w-5 bg-sky-300/60" />
    </div>
    <div className={`mt-4 ${side === 'right' ? 'text-right' : ''}`}>{children}</div>
  </aside>;
}

export function BrainCircuitHero() {
  return <div className="relative mx-auto flex h-[min(76vh,760px)] min-h-[430px] w-full max-w-6xl items-center justify-center sm:min-h-[540px]">
    <div className="absolute left-1/2 top-1/2 h-[88vw] max-h-[840px] min-h-[390px] w-[88vw] max-w-[840px] min-w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/10 blur-3xl landing-brain-aura" />
    <div className="absolute left-1/2 top-1/2 h-[78vw] max-h-[760px] min-h-[360px] w-[78vw] max-w-[760px] min-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/15 landing-orbit" />
    <div className="absolute left-1/2 top-1/2 h-[62vw] max-h-[620px] min-h-[300px] w-[62vw] max-w-[620px] min-w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-sky-300/20 landing-orbit-slow" />
    <div className="absolute left-1/2 top-[51%] h-[48vw] max-h-[500px] min-h-[260px] w-[48vw] max-w-[500px] min-w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400/10" />

    <HudPanel title="Core Systems" className="absolute left-0 top-[15%] w-72">
      <div className="grid gap-4">
        {['Neural Engine', 'Memory Layer', 'Context Module', 'Focus Protocol', 'Synapse Grid'].map((item) => <div key={item} className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">{item}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-sky-300">Active</p>
          </div>
          <svg viewBox="0 0 58 18" className="h-5 w-14 text-sky-300/70" aria-hidden="true">
            <path d="M0 10h12l4-6 5 12 5-9h32" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>)}
      </div>
    </HudPanel>

    <HudPanel side="right" title="Neural Activity" className="absolute right-0 top-[18%] w-72">
      <svg viewBox="0 0 250 78" className="h-24 w-full text-sky-300" aria-hidden="true">
        <defs>
          <linearGradient id="activityGlow" x1="0" x2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path d="M0 58 L12 54 L20 18 L31 62 L44 48 L55 28 L64 54 L75 46 L84 16 L95 60 L106 44 L118 51 L131 22 L143 58 L154 48 L166 34 L178 50 L190 18 L202 59 L216 42 L230 52 L250 31" fill="none" stroke="url(#activityGlow)" strokeWidth="2" className="landing-hud-line" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
        <span>Activity Level</span><span className="text-sky-300">82%</span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-slate-800"><div className="h-full w-[82%] rounded-full bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.7)]" /></div>
    </HudPanel>

    <HudPanel side="right" title="Thought Stream" className="absolute bottom-[19%] right-0 w-72">
      <div className="grid gap-3 text-left">
        {['Analyzing Context', 'Retrieving Memory', 'Building Patterns', 'Executing Plan'].map((item) => <div key={item} className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.9)]" />
          {item}
        </div>)}
      </div>
    </HudPanel>

    <div className="absolute bottom-[5%] left-1/2 h-24 w-[70vw] max-w-[720px] -translate-x-1/2 rounded-[50%] border border-sky-300/25 bg-sky-400/5 shadow-[0_0_80px_rgba(14,165,233,0.36),inset_0_0_44px_rgba(14,165,233,0.16)]" />
    <div className="absolute bottom-[9%] left-1/2 h-11 w-[38vw] max-w-[430px] -translate-x-1/2 rounded-[50%] bg-sky-200/25 blur-xl" />
    <div className="absolute bottom-[11%] left-1/2 h-[27vh] w-px -translate-x-1/2 bg-gradient-to-t from-sky-100 via-sky-300/80 to-transparent shadow-[0_0_30px_rgba(125,211,252,0.95)]" />

    <svg viewBox="0 0 800 620" className="relative z-10 h-full w-full max-w-4xl overflow-visible landing-brain-svg" role="img" aria-label="Animated Brain OS neural circuit">
      <defs>
        <filter id="blueGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.03 0 0 0 0 0.6 0 0 0 0 1 0 0 0 1 0" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="brainStroke" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <radialGradient id="brainFill" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#38bdf8" stopOpacity="0.28" />
          <stop offset="0.42" stopColor="#0284c7" stopOpacity="0.13" />
          <stop offset="1" stopColor="#020617" stopOpacity="0.02" />
        </radialGradient>
      </defs>

      <g className="landing-brain-core" filter="url(#blueGlow)">
        <path className="landing-brain-fill" d="M398 105 C322 82 250 113 218 174 C160 181 122 230 136 288 C99 334 122 405 184 424 C221 485 304 500 366 457 C407 499 498 497 532 432 C604 421 650 366 636 304 C677 246 636 178 577 174 C546 113 472 81 398 105Z" fill="url(#brainFill)" />
        <path className="landing-brain-outline" d="M398 105 C322 82 250 113 218 174 C160 181 122 230 136 288 C99 334 122 405 184 424 C221 485 304 500 366 457 C407 499 498 497 532 432 C604 421 650 366 636 304 C677 246 636 178 577 174 C546 113 472 81 398 105Z" fill="none" stroke="url(#brainStroke)" strokeWidth="5" strokeLinecap="round" />
        <path className="landing-brain-spine" d="M400 96 L400 496 C400 538 420 563 456 588" fill="none" stroke="#e0f7ff" strokeWidth="4" strokeLinecap="round" />

        <g className="landing-circuit-lines" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M230 202 C274 154 312 176 338 218 C356 248 384 250 400 232" />
          <path d="M568 204 C522 152 486 176 462 218 C444 248 416 250 400 232" />
          <path d="M184 290 C230 255 282 258 322 300 C350 329 380 330 400 315" />
          <path d="M616 292 C566 254 515 258 478 300 C450 330 420 330 400 315" />
          <path d="M210 385 C274 344 328 365 374 417" />
          <path d="M590 382 C522 342 468 365 424 417" />
          <path d="M260 140 C296 123 330 132 358 164" />
          <path d="M540 140 C504 123 468 132 442 164" />
          <path d="M250 250 L298 250 L318 225 L360 225" />
          <path d="M550 250 L502 250 L482 225 L440 225" />
          <path d="M258 330 L318 330 L344 360 L388 360" />
          <path d="M542 330 L482 330 L456 360 L412 360" />
        </g>

        <g className="landing-electric-bolts" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {sparks.map((spark) => <path key={spark} d={spark} />)}
        </g>

        <g className="landing-node-layer">
          {nodes.map(([cx, cy], index) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={index % 3 === 0 ? 6 : 4} style={{ animationDelay: `${index * 0.14}s` }} />)}
        </g>
      </g>
    </svg>
  </div>;
}
