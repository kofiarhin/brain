import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/resources';
import { useAuth } from '../auth/AuthContext';

export function Login() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to={location.state?.from?.pathname || '/'} replace />;

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const auth = await api.auth.login(form);
      login(auth);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (loginError) {
      setError(loginError.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <h1 className="text-2xl font-bold">Sign in to Brain OS</h1>
      <p className="mt-2 text-sm text-slate-400">Use the single admin credentials configured on the server.</p>
      {error && <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      <label className="mt-5 block text-sm font-medium text-slate-200" htmlFor="username">Username</label>
      <input id="username" name="username" value={form.username} onChange={updateField} autoComplete="username" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-500" required />
      <label className="mt-4 block text-sm font-medium text-slate-200" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" value={form.password} onChange={updateField} autoComplete="current-password" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-blue-500" required />
      <button type="submit" disabled={isSubmitting} className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  </main>;
}
