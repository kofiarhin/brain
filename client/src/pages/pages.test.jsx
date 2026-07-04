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
import { DayPlan } from './DayPlan';
import { Preferences } from './Preferences';
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

describe('Preferences page', () => {
  const preference = {
    _id: 'pref1',
    title: 'Default Preferences',
    active: true,
    scheduling: {
      planningWindowStart: '04:00',
      planningWindowEnd: '21:00',
      deepWorkPreferredTime: 'morning',
      gymPreferredTime: 'afternoon',
      meetingAvoidBefore: '10:00',
      bufferTimeRequired: true,
    },
    planning: {
      maxDailyTasks: 5,
      minimizeContextSwitching: true,
      preferHighImpactExecution: true,
      carryOverFirst: true,
    },
    personalConstraints: {
      workFromHome: true,
      familyResponsibilities: true,
      schoolRuns: true,
      helpingLauraWithAto: true,
    },
    output: {
      concise: true,
      includeMotivationalPost: true,
      includeDavidGogginsQuote: true,
      includeStoicQuote: true,
      includeInsightOfTheDay: true,
    },
    agentBehaviour: {
      verbosity: 'concise',
      autonomy: 'medium',
    },
    notes: 'Protect deep work.',
  };

  test('renders fetched preferences', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => preference });

    render(<Preferences />, { wrapper: wrapper() });

    expect(await screen.findByDisplayValue('Default Preferences')).toBeInTheDocument();
    expect(screen.getByLabelText('Planning window start')).toHaveValue('04:00');
    expect(screen.getByLabelText('Max daily tasks')).toHaveValue(5);
    expect(screen.getByLabelText('Verbosity')).toHaveValue('concise');
    expect(screen.getByLabelText('Notes')).toHaveValue('Protect deep work.');
  });

  test('editing a field and saving calls the active PATCH endpoint', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/preferences/active') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ ...preference, planning: { ...preference.planning, maxDailyTasks: 3 } }) });
      }
      return Promise.resolve({ ok: true, json: async () => preference });
    });

    render(<Preferences />, { wrapper: wrapper() });

    const maxDailyTasks = await screen.findByLabelText('Max daily tasks');
    await userEvent.clear(maxDailyTasks);
    await userEvent.type(maxDailyTasks, '3');
    await userEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/preferences/active'), expect.objectContaining({ method: 'PATCH' })));
    const patchCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/preferences/active') && options?.method === 'PATCH');
    expect(JSON.parse(patchCall[1].body)).toEqual(expect.objectContaining({
      active: true,
      planning: expect.objectContaining({ maxDailyTasks: 3 }),
    }));
  });

  test('boolean checkboxes update correctly', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/preferences/active') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ ...preference, output: { ...preference.output, includeMotivationalPost: false } }) });
      }
      return Promise.resolve({ ok: true, json: async () => preference });
    });

    render(<Preferences />, { wrapper: wrapper() });

    const checkbox = await screen.findByLabelText('Include motivational post');
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/preferences/active'), expect.objectContaining({ method: 'PATCH' })));
    const patchCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/preferences/active') && options?.method === 'PATCH');
    expect(JSON.parse(patchCall[1].body).output.includeMotivationalPost).toBe(false);
  });
});

describe('DayPlan page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-30T10:00:00.000Z'));
  });

  test('initial view shows today date and empty state when plan is null', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/day-plans/by-date/2026-06-30')) {
        return Promise.resolve({ ok: true, json: async () => ({ date: '2026-06-30', plan: null }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<DayPlan />, { wrapper: wrapper() });

    expect(screen.getByText('Tuesday, 30 Jun 2026')).toBeInTheDocument();
    expect(await screen.findByText('No plan was generated for this day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeDisabled();
    expect(screen.queryByText('Previous Plans')).not.toBeInTheDocument();
    expect(screen.queryByText(/Page/i)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/day-plans/by-date/2026-06-30'), expect.any(Object));
  });

  test('renders the saved plan for the viewed date', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/day-plans/by-date/2026-06-30')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            date: '2026-06-30',
            plan: {
              _id: 'dp1',
              londonDate: '2026-06-30',
              startTime: '2026-06-30T08:00:00.000Z',
              status: 'active',
              sessionType: 'start',
              focus: 'Today focus',
              priorities: ['Today priority'],
              schedule: [{ time: '09:00', title: 'Deep work' }],
              mustDo: ['Today must'],
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<DayPlan />, { wrapper: wrapper() });

    expect(await screen.findByText('Today focus')).toBeInTheDocument();
    expect(screen.getByText('Plan Window')).toBeInTheDocument();
    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByText('Plan Timeline')).toBeInTheDocument();
    expect(screen.queryByText("Historical plan, not today's active plan.")).not.toBeInTheDocument();
  });

  test('shows task actions on day plan timeline cards and completes from the dropdown', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let completed = false;
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/tasks/t1/complete') && options?.method === 'PATCH') {
        completed = true;
        return Promise.resolve({ ok: true, json: async () => ({ _id: 't1', title: 'Timeline task', status: 'complete', completedAt: new Date().toISOString() }) });
      }
      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: async () => completed
            ? [{ _id: 't1', title: 'Timeline task', status: 'complete', completedAt: new Date().toISOString() }]
            : [{ _id: 't1', title: 'Timeline task', status: 'open' }],
        });
      }
      if (url.includes('/day-plans/by-date/2026-06-30')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            date: '2026-06-30',
            plan: { _id: 'dp1', londonDate: '2026-06-30', schedule: [{ time: '09:00', title: 'Timeline task' }] },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<DayPlan />, { wrapper: wrapper() });

    expect(await screen.findByText('Timeline task')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Actions for Timeline task' }));
    await user.click(screen.getByRole('menu').querySelector('button'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/complete'), expect.objectContaining({ method: 'PATCH' })));
    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('reassigns and postpones a day plan timeline task from the dropdown', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const tomorrow = addLondonDays(getLondonDateKey(), 1);
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/tasks/t1/reschedule') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ _id: 't1', title: 'Move timeline task', status: 'rescheduled', scheduledLondonDate: tomorrow, agentReady: true }) });
      }
      if (url.includes('/tasks/t1') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ _id: 't1', title: 'Move timeline task', status: 'open', agentReady: true }) });
      }
      if (url.includes('/tasks')) {
        return Promise.resolve({ ok: true, json: async () => [{ _id: 't1', title: 'Move timeline task', status: 'open', agentReady: false }] });
      }
      if (url.includes('/day-plans/by-date/2026-06-30')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            date: '2026-06-30',
            plan: { _id: 'dp1', londonDate: '2026-06-30', schedule: [{ time: '10:00', title: 'Move timeline task' }] },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<DayPlan />, { wrapper: wrapper() });

    expect(await screen.findByText('Move timeline task')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Actions for Move timeline task' }));
    await user.click(screen.getByRole('button', { name: 'Reassign to Codex' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1'), expect.objectContaining({ method: 'PATCH' })));
    const updateCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/tasks/t1') && !url.includes('/reschedule') && options?.method === 'PATCH');
    expect(JSON.parse(updateCall[1].body)).toEqual({ agentReady: true });

    await user.click(await screen.findByRole('button', { name: 'Actions for Move timeline task' }));
    await user.click(screen.getByRole('button', { name: 'Postpone' }));
    await user.click(screen.getByRole('button', { name: 'Tomorrow' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/reschedule'), expect.objectContaining({ method: 'PATCH' })));
    const rescheduleCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/tasks/t1/reschedule') && options?.method === 'PATCH');
    expect(JSON.parse(rescheduleCall[1].body)).toEqual({ targetDate: tomorrow, reason: 'tomorrow' });
  });

  test('opens outcome options on day plan timeline tasks', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/tasks/t1/archive') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ _id: 't1', title: 'Outcome timeline task', status: 'archived' }) });
      }
      if (url.includes('/tasks')) {
        return Promise.resolve({ ok: true, json: async () => [{ _id: 't1', title: 'Outcome timeline task', status: 'open' }] });
      }
      if (url.includes('/day-plans/by-date/2026-06-30')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            date: '2026-06-30',
            plan: { _id: 'dp1', londonDate: '2026-06-30', schedule: [{ time: '11:00', title: 'Outcome timeline task' }] },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<DayPlan />, { wrapper: wrapper() });

    expect(await screen.findByText('Outcome timeline task')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Actions for Outcome timeline task' }));
    await user.click(screen.getByRole('button', { name: 'Outcome' }));
    expect(screen.getByRole('button', { name: 'Dismiss / No longer relevant' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/archive'), expect.objectContaining({ method: 'PATCH' })));
  });

  test('previous day updates viewedDate and refetches', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    global.fetch = vi.fn((url) => {
      if (url.includes('/day-plans/by-date/2026-06-29')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ date: '2026-06-29', plan: { _id: 'dp2', londonDate: '2026-06-29', focus: 'Yesterday focus' } }),
        });
      }
      if (url.includes('/day-plans/by-date/2026-06-30')) {
        return Promise.resolve({ ok: true, json: async () => ({ date: '2026-06-30', plan: null }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<DayPlan />, { wrapper: wrapper() });

    expect(await screen.findByText('No plan was generated for this day.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '← Previous Day' }));
    expect(await screen.findByText('Yesterday focus')).toBeInTheDocument();
    expect(screen.getByText('Monday, 29 Jun 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeEnabled();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/day-plans/by-date/2026-06-29'), expect.any(Object));
  });

  test('today button jumps back to today and disables', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    global.fetch = vi.fn((url) => {
      if (url.includes('/day-plans/by-date/2026-06-29')) {
        return Promise.resolve({ ok: true, json: async () => ({ date: '2026-06-29', plan: null }) });
      }
      if (url.includes('/day-plans/by-date/2026-06-30')) {
        return Promise.resolve({ ok: true, json: async () => ({ date: '2026-06-30', plan: null }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<DayPlan />, { wrapper: wrapper() });

    expect(await screen.findByText('No plan was generated for this day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '← Previous Day' }));
    expect(await screen.findByText('Monday, 29 Jun 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(await screen.findByText('Tuesday, 30 Jun 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeDisabled();
  });
});

describe('Tasks redesigned experience', () => {
  test('renders clean task rows with detail actions instead of per-card action clutter', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/projects')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ _id: '1', title: 'Focused task', priority: 'must', status: 'open', category: 'general', expectedDeliverable: 'Ship calmer task UI' }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Tasks />, { wrapper: wrapper() });

    expect((await screen.findAllByText('Focused task')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Start' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Complete' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'More task actions' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy task title' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Postpone Focused task/)).not.toBeInTheDocument();
  });

  test('filters into recommended views and keeps future tasks out of today', async () => {
    const today = getLondonDateKey();
    const tomorrow = addLondonDays(today, 1);
    global.fetch = vi.fn((url) => {
      if (url.includes('/projects')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { _id: '1', title: 'Today task', priority: 'must', status: 'open', scheduledLondonDate: today },
            { _id: '2', title: 'Future task', priority: 'medium', status: 'open', scheduledLondonDate: tomorrow },
            { _id: '3', title: 'Delegated task', priority: 'low', status: 'open', agentReady: true },
            { _id: '4', title: 'Completed task', priority: 'nice', status: 'complete', completedAt: new Date().toISOString() },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Tasks />, { wrapper: wrapper() });

    expect((await screen.findAllByText('Today task')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Future task')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Upcoming 1/ }));
    expect((await screen.findAllByText('Future task')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /Delegated 1/ }));
    expect((await screen.findAllByText('Delegated task')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /Completed 1/ }));
    expect((await screen.findAllByText('Completed task')).length).toBeGreaterThan(0);
  });

  test('captures a task through the mobile-first capture sheet', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/projects')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url.includes('/tasks') && options?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ _id: '1', title: 'Captured task', priority: 'high', agentReady: true }) });
      }
      if (url.includes('/tasks')) return Promise.resolve({ ok: true, json: async () => [] });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Tasks />, { wrapper: wrapper() });
    await userEvent.click(screen.getAllByRole('button', { name: /Capture/i })[0]);
    await userEvent.type(await screen.findByLabelText('Task title'), 'Captured task');
    await userEvent.selectOptions(screen.getByLabelText('Task priority'), 'high');
    await userEvent.click(screen.getByLabelText('Assignable to Codex'));
    await userEvent.click(screen.getByRole('button', { name: /save task/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks'), expect.objectContaining({ method: 'POST' })));
    const postCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/tasks') && options?.method === 'POST');
    expect(JSON.parse(postCall[1].body)).toEqual({ title: 'Captured task', priority: 'high', agentReady: true });
  });

  test('uses a single completion dialog for finish and postpone outcomes', async () => {
    const tomorrow = addLondonDays(getLondonDateKey(), 1);
    let taskState = { _id: '1', title: 'Dialog task', priority: 'must', status: 'open' };
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/projects')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url.includes('/tasks/1/reschedule') && options?.method === 'PATCH') {
        taskState = { ...taskState, status: 'rescheduled', scheduledLondonDate: tomorrow };
        return Promise.resolve({ ok: true, json: async () => taskState });
      }
      if (url.includes('/tasks')) return Promise.resolve({ ok: true, json: async () => [taskState] });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect((await screen.findAllByText('Dialog task')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Complete' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Postponed' }));
    fireEvent.change(screen.getByLabelText('New date'), { target: { value: tomorrow } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1/reschedule'), expect.objectContaining({ method: 'PATCH' })));
    const patchCall = global.fetch.mock.calls.find(([url, options]) => url.includes('/tasks/1/reschedule') && options?.method === 'PATCH');
    expect(JSON.parse(patchCall[1].body)).toEqual({ targetDate: tomorrow, reason: 'postponed' });
  });

  test('edits and saves task detail fields from the inspector drawer', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/projects')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url.includes('/tasks/1') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ _id: '1', title: 'Edited task', priority: 'high', status: 'open', category: 'admin', notes: 'Planning notes' }) });
      }
      if (url.includes('/tasks')) return Promise.resolve({ ok: true, json: async () => [{ _id: '1', title: 'Editable task', priority: 'must', status: 'open', category: 'general' }] });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect((await screen.findAllByText('Editable task')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(await screen.findByRole('dialog', { name: /Editable task/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Edited task' } });
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'admin');
    await userEvent.click(screen.getByRole('button', { name: 'Notes' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes' }), { target: { value: 'Planning notes' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1'), expect.objectContaining({ method: 'PATCH' })));
    const patchCall = global.fetch.mock.calls.filter(([url, options]) => url.includes('/tasks/1') && options?.method === 'PATCH').at(-1);
    expect(JSON.parse(patchCall[1].body)).toEqual(expect.objectContaining({ title: 'Edited task', category: 'admin', notes: 'Planning notes' }));
  });

  test('opens, switches, and closes the task inspector drawer', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/projects')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ _id: '1', title: 'Inspectable task', priority: 'must', status: 'open', description: 'Full detail', acceptanceCriteria: 'Check item' }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect((await screen.findAllByText('Inspectable task')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(await screen.findByRole('dialog', { name: /Inspectable task/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Checklist' }));
    expect(screen.getByRole('heading', { name: 'Checklist' })).toBeInTheDocument();
    expect(screen.getAllByText('Check item').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Notes' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close task inspector' }));
    expect(screen.queryByRole('dialog', { name: /Inspectable task/ })).not.toBeInTheDocument();
  });

  test('opens focused execution mode for a selected task', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/projects')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url.includes('/tasks')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ _id: '1', title: 'Execute task', priority: 'must', status: 'open', expectedDeliverable: 'Focused output', acceptanceCriteria: 'First step' }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Tasks />, { wrapper: wrapper() });
    expect((await screen.findAllByText('Execute task')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Start' })[0]);
    expect(screen.getByText('Execution mode')).toBeInTheDocument();
    expect(screen.getAllByText('Focused output').length).toBeGreaterThan(0);
    expect(screen.getAllByText('First step').length).toBeGreaterThan(0);
  });

  test('standalone task detail route saves and completes through the redesigned workspace', async () => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/projects')) return Promise.resolve({ ok: true, json: async () => [] });
      if (url.includes('/tasks/1/complete') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ _id: '1', title: 'Route task', priority: 'must', status: 'complete', category: 'general' }) });
      }
      if (url.includes('/tasks/1') && options?.method === 'PATCH') {
        return Promise.resolve({ ok: true, json: async () => ({ _id: '1', title: 'Route task saved', priority: 'must', status: 'open', category: 'general' }) });
      }
      if (url.includes('/tasks/1')) return Promise.resolve({ ok: true, json: async () => ({ _id: '1', title: 'Route task', priority: 'must', status: 'open', category: 'general' }) });
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter initialEntries={['/tasks/1']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
          <Routes><Route path="/tasks/:id" element={<TaskDetails />} /></Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Route task')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(await screen.findByDisplayValue('Route task')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Complete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/1/complete'), expect.objectContaining({ method: 'PATCH' })));
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

import { GeneratedPosts } from './GeneratedPosts';

describe('GeneratedPosts page', () => {
  const firstPage = {
    items: [{
      _id: 'gp1', status: 'success', selectedTopic: 'AI operating systems', runDate: '2026-07-03T08:00:00.000Z',
      topicRationale: 'High conversion topic', researchSummary: 'Research summary', linkedInPost: 'LinkedIn copy', xPost: 'X copy', inspirationalMessage: 'Ship it', reviewNotes: ['Looks good'], iterationCount: 1,
    }],
    pagination: { page: 1, limit: 10, total: 2, totalPages: 2, hasNextPage: true, hasPreviousPage: false },
  };
  const secondPage = {
    items: [{ _id: 'gp2', status: 'partial', selectedTopic: 'Cloud security', runDate: '2026-07-02T08:00:00.000Z', linkedInPost: 'Second LinkedIn', reviewNotes: [], iterationCount: 0 }],
    pagination: { page: 2, limit: 10, total: 2, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
  };

  test('renders fetched posts', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => firstPage });
    render(<GeneratedPosts />, { wrapper: wrapper() });
    expect((await screen.findAllByText('AI operating systems')).length).toBeGreaterThan(0);
    expect(screen.getByText('Research summary')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn copy')).toBeInTheDocument();
    expect(screen.getByText('Ship it')).toBeInTheDocument();
  });

  test('pagination controls call the API with next page', async () => {
    global.fetch = vi.fn((url) => Promise.resolve({ ok: true, json: async () => url.includes('page=2') ? secondPage : firstPage }));
    render(<GeneratedPosts />, { wrapper: wrapper() });
    expect((await screen.findAllByText('AI operating systems')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('page=2'), expect.any(Object)));
    expect((await screen.findAllByText('Cloud security')).length).toBeGreaterThan(0);
  });

  test('copy LinkedIn button writes to clipboard and shows copied feedback', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => firstPage });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } });
    render(<GeneratedPosts />, { wrapper: wrapper() });
    expect(await screen.findByText('LinkedIn copy')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy LinkedIn' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('LinkedIn copy');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
