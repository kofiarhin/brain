import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Notes } from './Notes';
import { Tasks } from './Tasks';
import { Dashboard } from './Dashboard';
import { Projects } from './Projects';
import { Deliverables } from './Deliverables';
import { getLondonDateKey } from '../utils/londonDate';

function wrapper() { const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>; }

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

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

describe('Deliverables page', () => {
  test('shows artifact actions without task lifecycle controls', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ _id: 'd1', title: 'Finished artifact', description: 'Ready for review', status: 'open' }],
    });

    render(<Deliverables />, { wrapper: wrapper() });

    expect(await screen.findByText('Finished artifact')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument();
  });

  test('edits and saves title and description', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ _id: 'd1', title: 'Old title', description: 'Old description' }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ _id: 'd1', title: 'New title', description: 'New description' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ _id: 'd1', title: 'New title', description: 'New description' }],
      });

    render(<Deliverables />, { wrapper: wrapper() });

    expect(await screen.findByText('Old title')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText('Title for Old title'));
    await userEvent.type(screen.getByLabelText('Title for Old title'), 'New title');
    await userEvent.clear(screen.getByLabelText('Description for Old title'));
    await userEvent.type(screen.getByLabelText('Description for Old title'), 'New description');
    await userEvent.click(screen.getAllByRole('button', { name: 'Save' }).at(-1));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/deliverables/d1'), expect.objectContaining({ method: 'PATCH' })));
    const patchCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/deliverables/d1') && options?.method === 'PATCH');
    expect(JSON.parse(patchCall[1].body)).toEqual({ title: 'New title', description: 'New description' });
  });

  test('cancels editing without saving', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ _id: 'd1', title: 'Original title', description: 'Original description' }],
    });

    render(<Deliverables />, { wrapper: wrapper() });

    expect(await screen.findByText('Original title')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText('Title for Original title'));
    await userEvent.type(screen.getByLabelText('Title for Original title'), 'Unsaved title');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Original title')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Unsaved title')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('archives and deletes through existing mutations', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ _id: 'd1', title: 'Artifact', description: 'Done' }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ _id: 'd1', title: 'Artifact', status: 'archived' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ _id: 'd1', title: 'Artifact', description: 'Done', status: 'archived' }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<Deliverables />, { wrapper: wrapper() });

    expect(await screen.findByText('Artifact')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/deliverables/d1/archive'), expect.objectContaining({ method: 'PATCH' })));

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/deliverables/d1'), expect.objectContaining({ method: 'DELETE' })));
  });
});

describe('Tasks page', () => {
  test('maps UTC timestamps to London calendar days', () => {
    expect(getLondonDateKey('2026-06-25T23:30:00.000Z')).toBe('2026-06-26');
    expect(getLondonDateKey('2026-06-25T22:30:00.000Z')).toBe('2026-06-25');
  });

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

  test('uses the same active task filters for tab counts and displayed priority groups', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: '1', title: 'Family high task', priority: 'high', status: 'open', category: 'family' },
        { _id: '2', title: 'Family medium task', priority: 'medium', status: 'open', category: 'family' },
        { _id: '3', title: 'Family missing priority task', status: 'open', category: 'family' },
        { _id: '4', title: 'Project high task', priority: 'high', status: 'open', category: 'projects' },
        { _id: '5', title: 'Project low task', priority: 'low', status: 'open', category: 'projects' },
        { _id: '6', title: 'Project invalid priority task', priority: 'urgent', status: 'open', category: 'projects' },
        { _id: '7', title: 'Project missing priority task', status: 'open', category: 'projects' },
        { _id: '8', title: 'Project nice task', priority: 'nice', status: 'open', category: 'projects' },
        { _id: '9', title: 'Project should task', priority: 'should', status: 'open', category: 'projects' },
        { _id: '10', title: 'Archived family task', priority: 'must', status: 'archived', category: 'family' },
        { _id: '11', title: 'Complete family task', priority: 'must', status: 'complete', category: 'family' },
        { _id: '12', title: 'Invalid category task', priority: 'must', status: 'open', category: 'work' },
      ],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByRole('button', { name: /Family 3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Projects 6/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /General 1/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Family 3/ }));
    expect(screen.getByText('Family high task')).toBeInTheDocument();
    expect(screen.getByText('Family medium task')).toBeInTheDocument();
    expect(screen.getByText('Family missing priority task')).toBeInTheDocument();
    expect(screen.queryByText('Archived family task')).not.toBeInTheDocument();
    expect(screen.queryByText('Complete family task')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Projects 6/ }));
    expect(screen.getByText('Project high task')).toBeInTheDocument();
    expect(screen.getByText('Project low task')).toBeInTheDocument();
    expect(screen.getByText('Project invalid priority task')).toBeInTheDocument();
    expect(screen.getByText('Project missing priority task')).toBeInTheDocument();
    expect(screen.getByText('Project nice task')).toBeInTheDocument();
    expect(screen.getByText('Project should task')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /General 1/ }));
    expect(screen.getByText('Invalid category task')).toBeInTheDocument();
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

  test('shows only tasks completed today grouped by category and hides them from active tabs', async () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: '1', title: 'Open project task', priority: 'must', status: 'open', category: 'projects' },
        { _id: '2', title: 'Done project task', priority: 'must', status: 'complete', category: 'projects', completedAt: today },
        { _id: '3', title: 'Done family task', priority: 'should', status: 'complete', category: 'family', completedAt: today },
        { _id: '4', title: 'Yesterday task', priority: 'should', status: 'complete', category: 'admin', completedAt: yesterday },
        { _id: '5', title: 'Archived task', priority: 'nice', status: 'archived', category: 'admin' },
      ],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Open project task')).toBeInTheDocument();
    expect(screen.queryByText('Done project task')).not.toBeInTheDocument();
    expect(screen.queryByText('Archived task')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Completed 2/ }));
    expect(screen.getByText('Done project task')).toBeInTheDocument();
    expect(screen.getByText('Done family task')).toBeInTheDocument();
    expect(screen.queryByText('Yesterday task')).not.toBeInTheDocument();
    expect(screen.queryByText('Open project task')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Family' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(2);
  });

  test('undo reopens a completed task and removes it after refresh', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ _id: '1', title: 'Done task', priority: 'must', status: 'complete', category: 'projects', completedAt: new Date().toISOString() }] })
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
