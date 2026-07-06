import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AnimatedBrain } from '../components/landing/AnimatedBrain';
import { CodeRain } from '../components/landing/CodeRain';

const metrics = [
  ['Memory', 'MongoDB long-term context'],
  ['Brain', 'Codex-powered command layer'],
  ['Signal', 'Daily planning + execution'],
];

const panels = [
  'Context indexed',
  'Tasks prioritized',
  'Focus protocol armed',
];

export function Landing() {
  const { isAuthenticated } = useAuth();
  const destination = isAuthenticated ? '/dashboard' : '/login';

  return <main className="relative min-h-screen overflow-hidden bg-black text-slate-100">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_75%_70%,rgba(30,64,175,0.18),transparent_36%),linear-gradient(135deg,#020617_0%,#020617_38%,#02030a_100%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
    <div className="absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(to_top,rgba(0,0,0,0.96),transparent)]" />
    <div className="absolute bottom-0 left-0 right-0 h-44 opacity-50 [background:linear-gradient(115deg,transparent_0_10%,rgba(15,23,42,0.9)_10%_16%,transparent_16%_22%,rgba(2,6,23,0.95)_22%_30%,transparent_30%_38%,rgba(15,23,42,0.85)_38%_45%,transparent_45%)]" />
    <CodeRain />

    <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
      <Link to="/" className="group flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-black">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/25 bg-sky-300/10 text-sm font-black text-sky-100 shadow-[0_0_36px_rgba(56,189,248,0.24)]">B</span>
        <span>
          <span className="block text-sm font-bold uppercase tracking-[0.32em] text-slate-100">Brain OS</span>
          <span className="block text-xs text-slate-500">Personal command system</span>
        </span>
      </Link>
      <Link to={destination} className="rounded-full border border-sky-200/20 bg-slate-950/70 px-5 py-2 text-sm font-semibold text-sky-100 shadow-[0_0_30px_rgba(14,165,233,0.15)] backdrop-blur transition hover:border-sky-200/50 hover:bg-sky-300/10">
        {isAuthenticated ? 'Open Dashboard' : 'Sign in'}
      </Link>
    </nav>

    <section className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-10 px-6 pb-14 pt-4 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-100 shadow-[0_0_28px_rgba(56,189,248,0.12)]">
          <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_16px_rgba(125,211,252,0.9)]" />
          System online
        </div>
        <h1 className="mt-7 text-5xl font-black uppercase leading-[0.92] tracking-[-0.08em] text-white sm:text-6xl lg:text-7xl">
          Your second brain.<br />Engineered for focus.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
          A dark command center for memory, planning, tasks, context, ideas, and execution. Built to feel less like a dashboard and more like entering your own operating system.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to={destination} className="rounded-xl bg-sky-100 px-6 py-3 text-center text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_42px_rgba(125,211,252,0.28)] transition hover:bg-white">
            {isAuthenticated ? 'Open Brain OS' : 'Enter Brain OS'}
          </Link>
          <a href="#systems" className="rounded-xl border border-slate-700/80 bg-slate-950/55 px-6 py-3 text-center text-sm font-bold uppercase tracking-[0.22em] text-slate-300 backdrop-blur transition hover:border-sky-300/40 hover:text-sky-100">
            View Systems
          </a>
        </div>
        <div id="systems" className="mt-10 grid gap-3 sm:grid-cols-3">
          {metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-sky-200">{label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{value}</p>
          </div>)}
        </div>
      </div>

      <div className="relative min-h-[420px] lg:min-h-[620px]">
        <div className="absolute inset-4 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-200/10" />
        <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-sky-200/15" />
        <AnimatedBrain />
        <div className="absolute right-0 top-8 hidden w-64 rounded-2xl border border-sky-200/15 bg-slate-950/70 p-4 shadow-2xl backdrop-blur md:block">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-sky-200">Neural status</p>
          <p className="mt-3 text-2xl font-black text-white">98.7%</p>
          <p className="mt-1 text-xs text-slate-500">Context signal integrity</p>
        </div>
        <div className="absolute bottom-10 left-0 hidden w-72 rounded-2xl border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur md:block">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">Active protocols</p>
          <div className="mt-4 grid gap-2">
            {panels.map((panel) => <div key={panel} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
              <span>{panel}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(125,211,252,0.9)]" />
            </div>)}
          </div>
        </div>
      </div>
    </section>
  </main>;
}
