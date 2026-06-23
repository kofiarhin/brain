import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { Notes } from './Notes';
import { Tasks } from './Tasks';
import { Dashboard } from './Dashboard';

function wrapper() { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>; }

beforeEach(() => { vi.restoreAllMocks(); });

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
  test('loads latest day plan', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ focus: 'Ship today', priorities: ['One'], mustDo: [], deliverables: [], winCondition: [] }) });
    render(<Dashboard />, { wrapper: wrapper() });
    expect(await screen.findByText('Ship today')).toBeInTheDocument();
  });
});
