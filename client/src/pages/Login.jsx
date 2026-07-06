import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/resources';
import { useAuth } from '../auth/AuthContext';
import { CodeRain } from '../components/landing/CodeRain';

export function Login() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const auth = await api.auth.login(form);
      login(auth);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-10 text-slate-100">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(56,189,248,0.16),transparent_34%),linear-gradient(135deg,#020617_0%,#020617_45%,#02030a_100%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:46px_46px]" />
    <CodeRain />

    <section className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
      <div className="hidden lg:block">
        <Link to="/" className="inline-flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-black">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-300/25 bg-sky-300/10 text-sm font-black text-sky-100 shadow-[0_0_36px_rgba(56,189,248,0.24)]">B</span>
          <span>
            <span className="block text-sm font-bold uppercase tracking-[0.32em] text-slate-100">Brain OS</span>
            <span className="block text-xs text-slate-500">Personal command system</span>
          </span>
        </Link>
        <h1 className="mt-10 max-w-xl text-5xl font-black uppercase leading-[0.95] tracking-[-0.07em] text-white">Enter the command center.</h1>
        <p className="mt-5 max-w-lg text-base leading-8 text-slate-400">Authenticate into your private operating layer for memory, context, planning, and execution.</p>
      </div>

      <form onSubmit={submit} className="w-full rounded-3xl border border-sky-200/15 bg-slate-950/75 p-6 shadow-[0_30px_120px_rgba(8,47,73,0.36)] backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-200">Secure access</p>
            <h1 className="mt-3 text-2xl font-black text-white">Sign in to Brain OS</h1>
          </div>
          <Link to="/" className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-sky-300/40 hover:text-sky-100">Landing</Link>
        </div>
        <p className="text-sm leading-6 text-slate-500">Use the single admin credentials configured on the server.</p>
        {error && <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        <label className="mt-6 block text-sm font-semibold text-slate-200" htmlFor="username">Username</label>
        <input id="username" name="username" value={form.username} onChange={updateField} autoComplete="username" className="mt-2 w-full rounded-xl border border-slate-700/80 bg-black/55 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-700 focus:border-sky-300/70 focus:ring-4 focus:ring-sky-300/10" required />
        <label className="mt-5 block text-sm font-semibold text-slate-200" htmlFor="password">Password</label>
        <div className="mt-2 flex rounded-xl border border-slate-700/80 bg-black/55 transition focus-within:border-sky-300/70 focus-within:ring-4 focus-within:ring-sky-300/10">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={updateField}
            autoComplete="current-password"
            className="min-w-0 flex-1 rounded-l-xl bg-transparent px-4 py-3 text-slate-100 outline-none"
            required
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="rounded-r-xl border-l border-slate-700/80 px-4 py-3 text-sm font-bold text-slate-400 transition hover:bg-sky-300/10 hover:text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-950"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <button type="submit" disabled={isSubmitting} className="mt-7 w-full rounded-xl bg-sky-100 px-5 py-3 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_42px_rgba(125,211,252,0.22)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? 'Signing in…' : 'Enter Brain OS'}
        </button>
      </form>
    </section>
  </main>;
}
