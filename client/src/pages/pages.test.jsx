import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Notes } from './Notes';
import { Tasks } from './Tasks';
import { Dashboard } from './Dashboard';
import { Projects } from './Projects';

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
    expect(await screen.findByText('Must task')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Complete'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1/complete'), expect.objectContaining({ method: 'PATCH' })));
  });

  test('filters tasks by category and agent readiness', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: '1', title: 'Project task', priority: 'must', status: 'open', category: 'projects', agentReady: true },
        { _id: '2', title: 'Family task', priority: 'should', status: 'open', category: 'family', agentReady: false },
        { _id: '3', title: 'Inbox task', priority: 'nice', status: 'open' },
        { _id: '4', title: 'Hidden agent task', priority: 'must', status: 'complete', category: 'projects', agentReady: true },
      ],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Project task')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /All 3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agent 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Projects 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Family 1/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Agent 1/ }));
    expect(screen.getByText('Tasks marked as assignable to Codex.')).toBeInTheDocument();
    expect(screen.getByText('Project task')).toBeInTheDocument();
    expect(screen.queryByText('Family task')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden agent task')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Family 1/ }));
    expect(screen.getByText('Family task')).toBeInTheDocument();
    expect(screen.queryByText('Project task')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /General 1/ }));
    expect(screen.getByText('Inbox task')).toBeInTheDocument();
    expect(screen.queryByText('Family task')).not.toBeInTheDocument();
  });

  test('creates a task without manual category and with agent readiness', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ _id: '1', title: 'New task', priority: 'must', category: 'projects', agentReady: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ _id: '1', title: 'New task', priority: 'must', status: 'open', category: 'projects', agentReady: true }] });

    render(<Tasks />, { wrapper: wrapper() });
    await screen.findByText('Create Task');
    await userEvent.type(screen.getByLabelText('Task title'), 'New task');
    await userEvent.selectOptions(screen.getByLabelText('Task priority'), 'must');
    expect(screen.queryByLabelText('Task category')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/^Assignable to Codex$/));
    await userEvent.click(screen.getByRole('button', { name: /save task/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks'), expect.objectContaining({ method: 'POST' })));
    const postCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/tasks') && options?.method === 'POST');
    expect(JSON.parse(postCall[1].body)).toEqual({ title: 'New task', priority: 'must', agentReady: true });
  });

  test('shows completed tasks grouped by category and hides them from active tabs', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: '1', title: 'Open project task', priority: 'must', status: 'open', category: 'projects' },
        { _id: '2', title: 'Done project task', priority: 'must', status: 'complete', category: 'projects' },
        { _id: '3', title: 'Done family task', priority: 'should', status: 'complete', category: 'family' },
        { _id: '4', title: 'Archived task', priority: 'nice', status: 'archived', category: 'admin' },
      ],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Open project task')).toBeInTheDocument();
    expect(screen.queryByText('Done project task')).not.toBeInTheDocument();
    expect(screen.queryByText('Archived task')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Completed 2/ }));
    expect(screen.getByText('Done project task')).toBeInTheDocument();
    expect(screen.getByText('Done family task')).toBeInTheDocument();
    expect(screen.queryByText('Open project task')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Family' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(2);
  });

  test('undo reopens a completed task and removes it after refresh', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ _id: '1', title: 'Done task', priority: 'must', status: 'complete', category: 'projects' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ _id: '1', title: 'Done task', status: 'open' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ _id: '1', title: 'Done task', priority: 'must', status: 'open', category: 'projects' }] });

    render(<Tasks />, { wrapper: wrapper() });
    await userEvent.click(await screen.findByRole('button', { name: /Completed 1/ }));
    expect(screen.getByText('Done task')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1/reopen'), expect.objectContaining({ method: 'PATCH' })));
    await waitFor(() => expect(screen.queryByText('Done task')).not.toBeInTheDocument());
  });

  test('updates task category and agent readiness', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ _id: '1', title: 'Editable task', priority: 'must', status: 'open', category: 'general', agentReady: false }] })
      .mockResolvedValue({ ok: true, json: async () => [{ _id: '1', title: 'Editable task', priority: 'must', status: 'open', category: 'projects', agentReady: true }] });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Editable task')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getAllByText('General').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Category for Editable task')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit'));
    await userEvent.selectOptions(screen.getByLabelText('Category for Editable task'), 'projects');
    await userEvent.click(screen.getByLabelText('Assignable to Codex for Editable task'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1'), expect.objectContaining({ method: 'PATCH' })));
    const patchBodies = global.fetch.mock.calls
      .filter(([url, options]) => url.includes('/tasks/1') && options?.method === 'PATCH')
      .map(([, options]) => JSON.parse(options.body));
    expect(patchBodies).toContainEqual({ category: 'projects', agentReady: true });
  });
});

describe('Projects page', () => {
  test('renders project execution CRUD fields', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{
        _id: 'p1',
        name: 'Brain OS',
        status: 'active',
        priority: 'high',
        focusToday: true,
        executionState: 'in_progress',
        progressPercent: 40,
        problemStatement: 'Projects need execution context',
        vision: 'Codex-ready project loop',
        prd: 'Store project PRD in MongoDB',
        definitionOfDone: 'Project can be planned and reviewed',
        summary: 'Custom CRUD state',
        blockers: ['Manual review needed'],
        agentPrompt: 'Use saved project context',
        productionReadiness: 'Needs checklist',
        productionChecklist: [{ title: 'Build passes', done: false }],
        nextActionableSteps: [{
          title: 'Ship Projects UI',
          done: false,
          priority: 'high',
          codexPrompt: 'Implement custom CRUD page',
          reviewRequired: true,
        }],
        progressUpdates: [{ date: '2026-06-25T00:00:00.000Z', progressPercent: 20, summary: 'Started', nextActionableSteps: ['Ship UI'], blockers: [] }],
      }],
    });

    render(<Projects />, { wrapper: wrapper() });

    expect(await screen.findByText('Projects')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Project name')).toHaveValue('Brain OS'));
    expect(screen.getByLabelText('Problem statement')).toHaveValue('Projects need execution context');
    expect(screen.getByLabelText('PRD')).toHaveValue('Store project PRD in MongoDB');
    expect(screen.getByLabelText('Definition of done')).toHaveValue('Project can be planned and reviewed');
    expect(screen.getByLabelText('Agent prompt')).toHaveValue('Use saved project context');
    expect(screen.getByLabelText('Checklist title 1')).toHaveValue('Build passes');
    expect(screen.getByLabelText('Step title 1')).toHaveValue('Ship Projects UI');
    expect(screen.getByLabelText('Codex prompt 1')).toHaveValue('Implement custom CRUD page');
    expect(screen.getByText('Progress Updates / History')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /edit project/i }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete project/i })).toBeInTheDocument();
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
    expect(await screen.findByText('Today Score')).toBeInTheDocument();
    expect(screen.getByText('Project Rings')).toBeInTheDocument();
    expect(screen.getByText('Brain Health')).toBeInTheDocument();
    expect(screen.getByText('Brain Globe')).toBeInTheDocument();
    expect(screen.queryByText('Operational Timeline')).not.toBeInTheDocument();
  });
});
