import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Notes } from './Notes';
import { Tasks } from './Tasks';
import { Dashboard } from './Dashboard';

function wrapper() { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>; }

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { cleanup(); });

describe('Notes page', () => {
  test('renders and saves a note', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [] }).mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ _id: '1', content: 'Test note' }) }).mockResolvedValueOnce({ ok: true, json: async () => [{ _id: '1', content: 'Test note' }] });
    render(<Notes />, { wrapper: wrapper() });
    expect(await screen.findByText('Notes')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Note content'), 'Test note');
    await userEvent.click(screen.getByRole('button', { name: /save note/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/notes'), expect.objectContaining({ method: 'POST' })));
  });
});

describe('Tasks page', () => {
  test('completes a task', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ _id: '1', title: 'Must task', priority: 'must', status: 'open' }] }).mockResolvedValueOnce({ ok: true, json: async () => ({ _id: '1', title: 'Must task', status: 'complete' }) }).mockResolvedValueOnce({ ok: true, json: async () => [] });
    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByDisplayValue('Must task')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Complete'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1/complete'), expect.objectContaining({ method: 'PATCH' })));
  });
});

describe('Dashboard', () => {
  test('loads premium mission control systems without duplicating the timeline', async () => {
    const jsonResponses = [
      { focus: 'Ship today', schedule: [{ time: '09:00-11:00', title: 'Deep work', activity: 'Build dashboard analytics', description: 'Ship the mission control view' }] },
      [{ _id: 'n1', content: 'Raw thought' }],
      [{ _id: 't1', title: 'Must task', status: 'open', dueDate: new Date().toISOString() }],
      [{ _id: 'd1', title: 'Demo', status: 'open' }],
      [{ _id: 'p1', name: 'Brain OS', status: 'active', nextActions: ['Ship dashboard'], blockers: [] }],
      [{ _id: 'i1', title: 'Idea' }],
      [{ _id: 'c1', category: 'routine', value: 'Gym' }],
      []
    ];
    global.fetch = vi.fn().mockImplementation(() => Promise.resolve({ ok: true, json: async () => jsonResponses.shift() }));
    render(<Dashboard />, { wrapper: wrapper() });
    expect(await screen.findByText('Mission Control')).toBeInTheDocument();
    expect(await screen.findByText('Neural Constellation')).toBeInTheDocument();
    expect(screen.getByText('Planetary Focus System')).toBeInTheDocument();
    expect(screen.getByText('Weekly Skyline')).toBeInTheDocument();
    expect(screen.getByText('Project Progress')).toBeInTheDocument();
    expect(screen.queryByText('Operational Timeline')).not.toBeInTheDocument();
  });
});
