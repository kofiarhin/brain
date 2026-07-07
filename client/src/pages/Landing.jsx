import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AnimatedBrain } from '../components/landing/AnimatedBrain';
import { CodeRain } from '../components/landing/CodeRain';

const systems = ['Memory', 'Neural', 'Context', 'Focus'];
const streams = ['ANALYZING', 'RECALLING', 'PLANNING', 'EXECUTING'];

export function Landing() {
  const { isAuthenticated } = useAuth();
  const destination = isAuthenticated ? '/dashboard' : '/login';

  return <main className="relative min-h-screen overflow-hidden bg-black text-slate-100">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(59,130,246,0.28),transparent_32%),radial-gradient(circle_at_50%_82%,rgba(14,165,233,0.2),transparent_22%),linear-gradient(180deg,#020617_0%,#02030a_52%,#000_100%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
    <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.92),transparent)]" />
    <div className="absolute inset-x-0 bottom-0 h-80 bg-[linear-gradient(to_top,rgba(0,0,0,0.98),transparent)]" />
    <div className="absolute bottom-0 left-0 right-0 h-44 opacity-70 [background:linear-gradient(115deg,transparent_0_8%,rgba(15,23,42,0.95)_8%_13%,transparent_13%_22%,rgba(2,6,23,0.96)_22%_31%,transparent_31%_39%,rgba(15,23,42,0.86)_39%_46%,transparent_46%)]" />
    <div className="absolute left-0 top-0 h-full w-40 bg-[linear-gradient(to_right,rgba(0,0,0,0.86),transparent)]" />
    <div className="absolute right-0 top-0 h-full w-40 bg-[linear-gradient(to_left,rgba(0,0,0,0.86),transparent)]" />
    <CodeRain />

    <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/" className="group flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-black" aria-label="Brain OS landing">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/30 bg-sky-300/10 text-sm font-black text-sky-100 shadow-[0_0_36px_rgba(56,189,248,0.24)]">B</span>
        <span className="hidden text-sm font-bold uppercase tracking-[0.32em] text-slate-100 sm:block">Brain OS</span>
      </Link>
      <div className="flex items-center gap-2 rounded-full border border-sky-300/15 bg-black/35 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-sky-100 backdrop-blur sm:text-xs">
        <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.95)]" />
        Online
      </div>
    </header>

    <section className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 pb-28 pt-4 sm:px-8 sm:pb-32">
      <div className="relative flex w-full max-w-6xl items-center justify-center">
        <div className="absolute left-1/2 top-1/2 h-[74vw] max-h-[760px] min-h-[360px] w-[74vw] max-w-[760px] min-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/10 blur-3xl landing-brain-aura" />
        <div className="absolute left-1/2 top-1/2 h-[72vw] max-h-[720px] min-h-[330px] w-[72vw] max-w-[720px] min-w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200/10 landing-orbit" />
        <div className="absolute left-1/2 top-1/2 h-[52vw] max-h-[540px] min-h-[260px] w-[52vw] max-w-[540px] min-w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-sky-200/15 landing-orbit-slow" />

        <div className="absolute bottom-[7%] left-1/2 h-24 w-[58vw] max-w-[720px] -translate-x-1/2 rounded-[50%] border border-sky-300/25 bg-sky-400/5 shadow-[0_0_70px_rgba(14,165,233,0.32),inset_0_0_40px_rgba(14,165,233,0.14)]" />
        <div className="absolute bottom-[11%] left-1/2 h-10 w-[34vw] max-w-[420px] -translate-x-1/2 rounded-[50%] bg-sky-200/20 blur-xl" />
        <div className="absolute bottom-[13%] left-1/2 h-[24vh] w-px -translate-x-1/2 bg-gradient-to-t from-sky-200/80 to-transparent shadow-[0_0_26px_rgba(125,211,252,0.9)]" />

        <AnimatedBrain className="relative z-10" />

        <div className="pointer-events-none absolute left-2 top-14 hidden w-56 rounded-2xl border border-sky-300/15 bg-black/42 p-4 shadow-2xl backdrop-blur md:block">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-sky-200/90">Core systems</p>
          <div className="grid gap-3">
            {systems.map((system) => <div key={system} className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-300">
              <span>{system}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.9)]" />
            </div>)}
          </div>
        </div>

        <div className="pointer-events-none absolute right-2 top-20 hidden w-64 rounded-2xl border border-sky-300/15 bg-black/42 p-4 shadow-2xl backdrop-blur lg:block">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-sky-200/90">Neural activity</p>
          <div className="mt-5 h-20 overflow-hidden rounded-lg border border-sky-300/10 bg-sky-300/5">
            <svg viewBox="0 0 220 70" className="h-full w-full text-sky-300/80" aria-hidden="true">
              <polyline points="0,52 10,50 18,20 27,55 38,48 45,28 52,45 61,42 70,10 77,53 86,45 96,49 108,18 116,52 127,47 138,31 146,44 158,15 166,50 176,46 185,41 196,48 207,27 220,44" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-20 right-4 hidden w-64 rounded-2xl border border-sky-300/15 bg-black/42 p-4 shadow-2xl backdrop-blur md:block">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-sky-200/90">Thought stream</p>
          <div className="grid gap-2">
            {streams.map((stream) => <div key={stream} className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300/90" />
              <span>{stream}</span>
            </div>)}
          </div>
        </div>
      </div>
    </section>

    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-black via-black/80 to-transparent px-5 pb-6 pt-12">
      <Link to={destination} className="group relative w-full max-w-md overflow-hidden rounded-2xl border border-sky-200/30 bg-sky-300/10 px-6 py-4 text-center text-sm font-black uppercase tracking-[0.34em] text-sky-50 shadow-[0_0_42px_rgba(14,165,233,0.35)] backdrop-blur transition hover:border-sky-100/70 hover:bg-sky-200/20 sm:text-base">
        <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition duration-700 group-hover:translate-x-[320%]" />
        {isAuthenticated ? 'Open Brain OS' : 'Enter Brain OS'}
      </Link>
    </div>
  </main>;
}
