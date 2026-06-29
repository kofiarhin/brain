import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Notes } from './Notes';
import { Tasks } from './Tasks';
import { TaskDetails } from './TaskDetails';
import { Dashboard } from './Dashboard';
import { Projects } from './Projects';
import { Reports } from './Reports';
import { addLondonDays, getLondonDateKey } from '../utils/londonDate';

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

describe('Tasks page', () => {
  test('maps UTC timestamps to London calendar days', () => {
    expect(getLondonDateKey('2026-06-25T23:30:00.000Z')).toBe('2026-06-26');
    expect(getLondonDateKey('2026-06-25T22:30:00.000Z')).toBe('2026-06-25');
  });

  test('shows complete shortcuts on open overview cards', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ _id: '1', title: 'Must task', priority: 'must', status: 'open' }] });
    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Must task')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy task title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Must task/ })).toHaveAttribute('href', '/tasks/1');
  });

  test('renders copy buttons for every open task card', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: '1', title: 'First open task', priority: 'must', status: 'open' },
        { _id: '2', title: 'Second open task', priority: 'should', status: 'open' },
        { _id: '3', title: 'Completed task', priority: 'nice', status: 'complete', completedAt: new Date().toISOString() },
      ],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('First open task')).toBeInTheDocument();
    expect(screen.getByText('Second open task')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy task title' })).toHaveLength(2);
  });

  test('hides postponed tasks until their scheduled date', async () => {
    const today = getLondonDateKey();
    const tomorrow = addLondonDays(today, 1);

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: '1', title: 'Today task', priority: 'must', status: 'open', scheduledLondonDate: today },
        { _id: '2', title: 'Tomorrow task', priority: 'must', status: 'open', scheduledLondonDate: tomorrow },
      ],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Today task')).toBeInTheDocument();
    expect(screen.queryByText('Tomorrow task')).not.toBeInTheDocument();
  });

  test('postpones an open task from the overview and removes it from today', async () => {
    const tomorrow = addLondonDays(getLondonDateKey(), 1);
    let postponed = false;
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/tasks/1/reschedule') && options?.method === 'PATCH') {
        postponed = true;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            _id: '1',
            title: 'Move me',
            priority: 'must',
            status: 'rescheduled',
            scheduledLondonDate: tomorrow,
            postponedCount: 1,
            scheduleHistory: [{ toScheduledLondonDate: tomorrow }],
          }),
        });
      }
      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: async () => postponed
            ? [{ _id: '1', title: 'Move me', priority: 'must', status: 'rescheduled', scheduledLondonDate: tomorrow }]
            : [{ _id: '1', title: 'Move me', priority: 'must', status: 'open' }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Move me')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Postpone Move me'), 'tomorrow');

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tasks/1/reschedule'),
      expect.objectContaining({ method: 'PATCH' })
    ));
    const patchCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/tasks/1/reschedule') && options?.method === 'PATCH');
    expect(JSON.parse(patchCall[1].body)).toEqual({ targetDate: tomorrow, reason: 'tomorrow' });
    await waitFor(() => expect(screen.queryByText('Move me')).not.toBeInTheDocument());
  });

  test('shows postponed tasks on their scheduled date', async () => {
    const today = getLondonDateKey();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: '1', title: 'Scheduled today task', priority: 'must', status: 'open', scheduledLondonDate: today, postponedCount: 1 },
      ],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Scheduled today task')).toBeInTheDocument();
    expect(screen.getByText(`Scheduled ${today}`)).toBeInTheDocument();
  });

  test('hides dismissed archived and converted tasks from active tabs', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: '1', title: 'Active task', priority: 'must', status: 'open' },
        { _id: '2', title: 'Dismissed task', priority: 'must', status: 'dismissed' },
        { _id: '3', title: 'Archived task', priority: 'should', status: 'archived' },
        { _id: '4', title: 'Converted task', priority: 'nice', status: 'converted' },
      ],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Active task')).toBeInTheDocument();
    expect(screen.queryByText('Dismissed task')).not.toBeInTheDocument();
    expect(screen.queryByText('Archived task')).not.toBeInTheDocument();
    expect(screen.queryByText('Converted task')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All 1/ })).toBeInTheDocument();
  });

  test('copies a task title without navigating or completing the task', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    window.history.pushState({}, '', '/tasks');
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ _id: '1', title: 'Copyable task', priority: 'must', status: 'open' }],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Copyable task')).toBeInTheDocument();
    const copyButton = screen.getByRole('button', { name: 'Copy task title' });
    await userEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith('Copyable task');
    expect(window.location.pathname).toBe('/tasks');
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/tasks/1/complete'), expect.objectContaining({ method: 'PATCH' }));
    await waitFor(() => expect(copyButton).toHaveAttribute('title', 'Copied'));
  });

  test('completes a task from the overview without navigating and refreshes tabs', async () => {
    const today = new Date().toISOString();
    let completed = false;
    window.history.pushState({}, '', '/tasks');
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/tasks/1/complete') && options?.method === 'PATCH') {
        completed = true;
        return Promise.resolve({ ok: true, json: async () => ({ _id: '1', title: 'Shortcut task', priority: 'must', status: 'complete', category: 'projects', completedAt: today }) });
      }
      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: async () => completed
            ? [{ _id: '1', title: 'Shortcut task', priority: 'must', status: 'complete', category: 'projects', completedAt: today }]
            : [{ _id: '1', title: 'Shortcut task', priority: 'must', status: 'open', category: 'projects' }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Shortcut task')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Complete' }));

    expect(window.location.pathname).toBe('/tasks');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1/complete'), expect.objectContaining({ method: 'PATCH' })));
    await waitFor(() => expect(screen.queryByText('Shortcut task')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Completed 1/ }));
    expect(await screen.findByText('Shortcut task')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy task title' })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Done project task/ })).toHaveAttribute('href', '/tasks/2');
  });

  test('links each task to its details page', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [{ _id: '1', title: 'Editable task', priority: 'must', status: 'open', category: 'general', agentReady: false, expectedDeliverable: 'Updated task brief' }],
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect(await screen.findByText('Editable task')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getAllByText('General').length).toBeGreaterThan(0);
    expect(screen.getByText('Updated task brief')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Editable task/ })).toHaveAttribute('href', '/tasks/1');
  });

  test('edits task details through the dedicated page', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/projects')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/tasks/1') && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            _id: '1',
            title: 'Updated task',
            priority: 'must',
            status: 'open',
            category: 'projects',
            description: 'New description',
            deliverableRequired: true,
            expectedDeliverable: 'New deliverable',
            deliverableSummary: 'New artifact notes',
            deliverableLocation: 'https://example.com/new',
            acceptanceCriteria: 'New criteria',
            notes: 'Planning notes',
            codexPrompt: 'Implement this',
          }),
        });
      }
      if (url.includes('/tasks/1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
          _id: '1',
          title: 'Editable task',
          priority: 'must',
          status: 'open',
          category: 'general',
          description: 'Old description',
          deliverableRequired: true,
          expectedDeliverable: 'Old deliverable',
          deliverableDescription: 'Old artifact notes',
          deliverableUrl: 'https://example.com/old',
          acceptanceCriteria: 'Old criteria',
          notes: '',
          codexPrompt: 'Implement this',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter initialEntries={['/tasks/1']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
          <Routes><Route path="/tasks/:id" element={<TaskDetails />} /></Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('Editable task')).toBeInTheDocument();
    expect(screen.queryByText('Advanced')).not.toBeInTheDocument();
    expect(screen.getByText('Agent Instructions')).toBeInTheDocument();
    expect(screen.getByText('Delegate this task to an AI agent.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Agent Instructions Prompt')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Updated task');
    await userEvent.click(screen.getByText('Task Settings'));
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'projects');
    await userEvent.clear(screen.getByLabelText('Task'));
    await userEvent.type(screen.getByLabelText('Task'), 'New description');
    await userEvent.clear(screen.getByLabelText('Expected Output'));
    await userEvent.type(screen.getByLabelText('Expected Output'), 'New deliverable');
    await userEvent.clear(screen.getByLabelText('Produced Output'));
    await userEvent.type(screen.getByLabelText('Produced Output'), 'New artifact notes');
    await userEvent.clear(screen.getByLabelText('Supporting Link'));
    await userEvent.type(screen.getByLabelText('Supporting Link'), 'https://example.com/new');
    await userEvent.clear(screen.getByLabelText('Completion Checklist'));
    await userEvent.type(screen.getByLabelText('Completion Checklist'), 'New criteria');
    await userEvent.type(screen.getByLabelText('Notes'), 'Planning notes');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1'), expect.objectContaining({ method: 'PATCH' })));
    const patchCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/tasks/1') && options?.method === 'PATCH');
    expect(JSON.parse(patchCall[1].body)).toEqual(expect.objectContaining({
      title: 'Updated task',
      category: 'projects',
      description: 'New description',
      deliverableRequired: true,
      expectedDeliverable: 'New deliverable',
      deliverableSummary: 'New artifact notes',
      deliverableLocation: 'https://example.com/new',
      acceptanceCriteria: 'New criteria',
      notes: 'Planning notes',
      codexPrompt: 'Implement this',
    }));
  }, 10000);

  test('shows and copies agent instructions from the detail workspace', async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    global.fetch = vi.fn((url) => {
      if (url.includes('/projects')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/tasks/1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            _id: '1',
            title: 'Delegation task',
            priority: 'must',
            status: 'open',
            category: 'general',
            deliverableRequired: true,
            codexPrompt: 'Implement the workspace refactor',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter initialEntries={['/tasks/1']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
          <Routes><Route path="/tasks/:id" element={<TaskDetails />} /></Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('Delegation task')).toBeInTheDocument();
    expect(screen.queryByLabelText('Agent Instructions Prompt')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy Prompt' }));
    expect(writeText).toHaveBeenCalledWith('Implement the workspace refactor');
    await userEvent.click(screen.getByRole('button', { name: 'Show Prompt' }));
    expect(screen.getByLabelText('Agent Instructions Prompt')).toHaveValue('Implement the workspace refactor');
    expect(screen.getByLabelText('Agent Instructions Prompt')).toHaveAttribute('readonly');
    await userEvent.click(screen.getByRole('button', { name: 'Hide Prompt' }));
    expect(screen.queryByLabelText('Agent Instructions Prompt')).not.toBeInTheDocument();
  });

  test('renders an empty agent instructions state without prompt controls', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/projects')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/tasks/1')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            _id: '1',
            title: 'Manual task',
            priority: 'should',
            status: 'open',
            category: 'general',
            deliverableRequired: true,
            codexPrompt: '',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter initialEntries={['/tasks/1']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
          <Routes><Route path="/tasks/:id" element={<TaskDetails />} /></Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('Manual task')).toBeInTheDocument();
    expect(screen.getByText('No AI instructions have been generated for this task.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy Prompt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Prompt' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agent Instructions Prompt')).not.toBeInTheDocument();
  });

  test('completes tasks from the detail workspace', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/projects')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/tasks/1/complete') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ _id: '1', title: 'Lifecycle task', priority: 'must', status: 'complete', category: 'general' }) });
      }
      if (url.includes('/tasks/1')) {
        return Promise.resolve({ ok: true, json: async () => ({ _id: '1', title: 'Lifecycle task', priority: 'must', status: 'open', category: 'general' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter initialEntries={['/tasks/1']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
          <Routes><Route path="/tasks/:id" element={<TaskDetails />} /></Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('Lifecycle task')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Complete task' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1/complete'), expect.objectContaining({ method: 'PATCH' })));
  });

  test('reopens tasks from the detail workspace', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/projects')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/tasks/1/reopen') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ _id: '1', title: 'Lifecycle task', priority: 'must', status: 'open', category: 'general' }) });
      }
      if (url.includes('/tasks/1')) {
        return Promise.resolve({ ok: true, json: async () => ({ _id: '1', title: 'Lifecycle task', priority: 'must', status: 'complete', category: 'general' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter initialEntries={['/tasks/1']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
          <Routes><Route path="/tasks/:id" element={<TaskDetails />} /></Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue('Lifecycle task')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reopen task' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1/reopen'), expect.objectContaining({ method: 'PATCH' })));
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
    expect(screen.getByRole('heading', { name: 'Danger Zone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete project/i })).toBeInTheDocument();
  });

  test('starts a blank editable creation flow from New Project', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          _id: 'p1',
          name: 'Existing Project',
          status: 'active',
          priority: 'high',
          executionState: 'in_progress',
          progressPercent: 40,
        }],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          _id: 'p2',
          name: 'Created Project',
          status: 'active',
          priority: 'medium',
          executionState: 'planning',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { _id: 'p1', name: 'Existing Project', status: 'active', priority: 'high', executionState: 'in_progress' },
          { _id: 'p2', name: 'Created Project', status: 'active', priority: 'medium', executionState: 'planning' },
        ],
      });

    render(<Projects />, { wrapper: wrapper() });

    expect(await screen.findByDisplayValue('Existing Project')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /new project/i }));

    const projectName = screen.getByLabelText('Project name');
    expect(projectName).toHaveValue('');
    expect(projectName).toBeEnabled();
    expect(screen.getByRole('button', { name: /save project/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Danger Zone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete project/i })).not.toBeInTheDocument();

    await userEvent.type(projectName, 'Created Project');
    await userEvent.click(screen.getByRole('button', { name: /save project/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/projects'), expect.objectContaining({ method: 'POST' })));
    const postCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/projects') && options?.method === 'POST');
    expect(JSON.parse(postCall[1].body)).toEqual(expect.objectContaining({
      name: 'Created Project',
      priority: 'medium',
      executionState: 'planning',
    }));
  });

  test('deletes an existing project from the danger zone after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let deleted = false;
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/projects/p1') && options?.method === 'DELETE') {
        deleted = true;
        return Promise.resolve({ ok: true, status: 204 });
      }
      if (url.includes('/projects')) {
        return Promise.resolve({
          ok: true,
          json: async () => deleted
            ? [{ _id: 'p2', name: 'Brain OS', status: 'active', priority: 'medium', executionState: 'planning' }]
            : [
              { _id: 'p1', name: 'Peekofo Telegram Integration', status: 'active', priority: 'high', executionState: 'in_progress' },
              { _id: 'p2', name: 'Brain OS', status: 'active', priority: 'medium', executionState: 'planning' },
            ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Projects />, { wrapper: wrapper() });

    expect(await screen.findByDisplayValue('Peekofo Telegram Integration')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /edit project/i }));
    expect(screen.getByRole('heading', { name: 'Danger Zone' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /delete project/i }));

    expect(confirm).toHaveBeenCalledWith('Delete "Peekofo Telegram Integration"? This cannot be undone.');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/projects/p1'), expect.objectContaining({ method: 'DELETE' })));
    await waitFor(() => expect(screen.queryByText('Peekofo Telegram Integration')).not.toBeInTheDocument());
    expect(screen.getByDisplayValue('Brain OS')).toBeInTheDocument();
  });
});

describe('Reports page', () => {
  const report = {
    _id: 'r1',
    runDate: '2026-06-25T09:00:00.000Z',
    status: 'partial',
    summary: 'Updated projects and skipped one ambiguous note.',
    recordsCreated: [{ model: 'Task', title: 'Task One' }],
    recordsUpdated: [{ model: 'Project', name: 'Brain OS' }],
    skippedItems: ['Ambiguous note'],
    linkedTasks: [{ title: 'Task One' }],
    linkedProjects: [{ name: 'Brain OS' }],
    warnings: ['Needs review'],
    errors: ['One note could not be classified'],
    nextRecommendedActions: ['Review skipped note'],
    metadata: { command: 'update brain' },
  };

  test('renders report list and detail sections without edit or delete controls', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [report] });

    render(<Reports />, { wrapper: wrapper() });

    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(await screen.findAllByText('Updated projects and skipped one ambiguous note.')).toHaveLength(2);
    expect(screen.getByText('Records Created')).toBeInTheDocument();
    expect(screen.getByText('Records Updated')).toBeInTheDocument();
    expect(screen.getByText('Skipped Items')).toBeInTheDocument();
    expect(screen.getByText('Linked Tasks')).toBeInTheDocument();
    expect(screen.getByText('Linked Projects')).toBeInTheDocument();
    expect(screen.getAllByText('Warnings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Errors').length).toBeGreaterThan(0);
    expect(screen.getByText('Next Recommended Actions')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getAllByText('Task One').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Brain OS').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  test('filters update report list queries', async () => {
    global.fetch = vi.fn()
      .mockResolvedValue({ ok: true, json: async () => [report] });

    render(<Reports />, { wrapper: wrapper() });

    await screen.findByText('Brain Update Reports');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'partial');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/brain-update-reports?status=partial'), expect.any(Object)));

    fireEvent.change(screen.getByLabelText('Date from'), { target: { value: '2026-06-24' } });
    fireEvent.change(screen.getByLabelText('Date to'), { target: { value: '2026-06-26' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('status=partial'), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('from=2026-06-24'), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('to=2026-06-26'), expect.any(Object));
    });
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
