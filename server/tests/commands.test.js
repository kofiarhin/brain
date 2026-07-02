import { beforeEach, describe, expect, test } from '@jest/globals';
import { executeGoodMorning, executeRefreshBrain, executeReplanDay, executeUpdateBrain } from '../services/commands/index.js';
import { normalizeTaskTitle } from '../services/taskNormalization.js';
import { runGoodMorningCommandScript } from '../scripts/goodMorning.js';
import { runRefreshBrainCommandScript } from '../scripts/refreshBrain.js';
import { runReplanDayCommandScript } from '../scripts/replanDay.js';
import { runUpdateBrainCommandScript } from '../scripts/updateBrain.js';

let tick = 0;

function nowTick() {
  tick += 1000;
  return new Date(Date.UTC(2026, 5, 26, 8, 0, 0, tick));
}

function clone(item) {
  return item ? { ...item } : item;
}

function valueAtPath(item, path) {
  return path.split('.').reduce((current, key) => current?.[key], item);
}

function matchesQuery(item, query = {}) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some((branch) => matchesQuery(item, branch));
    const actual = valueAtPath(item, key);
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$nin' in expected) return !expected.$nin.includes(actual);
      if ('$in' in expected) return expected.$in.includes(actual);
      if ('$gte' in expected && new Date(actual) < new Date(expected.$gte)) return false;
      if ('$lt' in expected && new Date(actual) >= new Date(expected.$lt)) return false;
      return true;
    }
    return actual === expected;
  });
}

function sortRecords(items, sort = {}) {
  return [...items].sort((left, right) => {
    for (const [field, direction] of Object.entries(sort)) {
      const leftValue = valueAtPath(left, field);
      const rightValue = valueAtPath(right, field);
      if (leftValue === rightValue) continue;
      if (leftValue === undefined || leftValue === null) return 1;
      if (rightValue === undefined || rightValue === null) return -1;
      return (leftValue < rightValue ? -1 : 1) * direction;
    }
    return 0;
  });
}

function queryChain(items) {
  let result = items.map(clone);
  const chain = {
    sort(sort) {
      result = sortRecords(result, sort);
      return chain;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return chain;
}

function fakeModel(name, defaults = {}) {
  let records = [];

  return class FakeModel {
    static modelName = name;
    static reset() { records = []; }
    static all() { return records.map(clone); }
    static normalize(payload) {
      const base = typeof defaults === 'function' ? defaults(payload) : { ...defaults, ...payload };
      if (name === 'task') {
        return {
          status: 'open',
          outcome: base.status || base.outcome || 'open',
          normalizedTitle: base.normalizedTitle || normalizeTaskTitle(base.title),
          outcomeHistory: [],
          scheduleHistory: [],
          ...base,
        };
      }
      if (name === 'preference') {
        return {
          active: true,
          scheduling: { planningWindowStart: '04:00', planningWindowEnd: '21:00' },
          planning: { maxDailyTasks: 5 },
          personalConstraints: {},
          output: {},
          agentBehaviour: {},
          ...base,
        };
      }
      if (name === 'brainUpdateReport') {
        return {
          recordsCreated: [],
          recordsUpdated: [],
          skippedItems: [],
          linkedTasks: [],
          linkedProjects: [],
          warnings: [],
          errors: [],
          nextRecommendedActions: [],
          metadata: {},
          ...base,
        };
      }
      return base;
    }
    static async create(payload) {
      const normalized = this.normalize(payload);
      const item = {
        _id: `${name}-${records.length + 1}`,
        ...normalized,
        createdAt: nowTick(),
        updatedAt: nowTick(),
      };
      records.push(item);
      return clone(item);
    }
    static find(query = {}) { return queryChain(records.filter((item) => matchesQuery(item, query))); }
    static findOne(query = {}) {
      return {
        sort: async (sort) => clone(sortRecords(records.filter((item) => matchesQuery(item, query)), sort)[0] || null),
      };
    }
    static async countDocuments(query = {}) {
      return records.filter((item) => matchesQuery(item, query)).length;
    }
    static async findByIdAndUpdate(id, payload) {
      const index = records.findIndex((item) => item._id === id);
      if (index === -1) return null;
      records[index] = this.normalize({ ...records[index], ...payload, updatedAt: nowTick() });
      return clone(records[index]);
    }
  };
}

const NoteModel = fakeModel('note');
const GoalModel = fakeModel('goal');
const ProjectModel = fakeModel('project', { status: 'active', executionState: 'planning' });
const IdeaModel = fakeModel('idea');
const ContextModel = fakeModel('context');
const PreferenceModel = fakeModel('preference');
const ReviewModel = fakeModel('review');
const TaskModel = fakeModel('task');
const DayPlanModel = fakeModel('dayPlan');
const DeliverableModel = fakeModel('deliverable', { status: 'open' });
const BrainUpdateReportModel = fakeModel('brainUpdateReport');

const models = {
  NoteModel,
  GoalModel,
  ProjectModel,
  IdeaModel,
  ContextModel,
  PreferenceModel,
  ReviewModel,
  TaskModel,
  DayPlanModel,
  DeliverableModel,
  BrainUpdateReportModel,
};

beforeEach(() => {
  tick = 0;
  Object.values(models).forEach((model) => model.reset());
});

describe('command services', () => {
  test('good morning creates one active plan and task workspaces', async () => {
    await TaskModel.create({ title: 'Implement command layer', priority: 'must' });

    const result = await executeGoodMorning({ ...models, now: new Date('2026-06-26T08:00:00.000Z') });

    expect(result.command).toBe('good-morning');
    expect(result.status).toBe('success');
    expect(DayPlanModel.all().filter((plan) => plan.status === 'active')).toHaveLength(1);
    expect(result.dayPlan.sessionType).toBe('start');
    expect(TaskModel.all().filter((task) => task.title === 'Implement command layer')).toHaveLength(1);
  });

  test('good morning archives previous active plan and leaves one active plan', async () => {
    const previous = await DayPlanModel.create({
      date: new Date('2026-06-25T08:00:00.000Z'),
      londonDate: '2026-06-25',
      status: 'active',
      sessionType: 'start',
      priorities: [],
      schedule: [],
      mustDo: [],
      shouldDo: [],
      niceToHave: [],
      unclearItems: [],
    });

    await executeGoodMorning({ ...models, now: new Date('2026-06-26T08:00:00.000Z') });

    expect(DayPlanModel.all().filter((plan) => plan.status === 'active')).toHaveLength(1);
    expect(DayPlanModel.all().find((plan) => plan._id === previous._id).status).toBe('archived');
  });

  test('good morning ignores tasks linked to blocked, completed, abandoned, archived, and production-ready projects', async () => {
    const active = await ProjectModel.create({ name: 'Active project', status: 'active', executionState: 'planning' });
    const blocked = await ProjectModel.create({ name: 'Blocked project', status: 'active', executionState: 'blocked' });
    const completed = await ProjectModel.create({ name: 'Completed project', status: 'completed', executionState: 'planning' });
    const abandoned = await ProjectModel.create({ name: 'Abandoned project', status: 'abandoned', executionState: 'planning' });
    const archived = await ProjectModel.create({ name: 'Archived project', status: 'archived', executionState: 'planning' });
    const productionReady = await ProjectModel.create({ name: 'Production-ready project', status: 'active', executionState: 'ready_for_production' });
    await TaskModel.create({ title: 'Active project task', priority: 'must', projectId: active._id });
    await TaskModel.create({ title: 'Blocked project task', priority: 'must', projectId: blocked._id });
    await TaskModel.create({ title: 'Completed project task', priority: 'must', projectId: completed._id });
    await TaskModel.create({ title: 'Abandoned project task', priority: 'must', projectId: abandoned._id });
    await TaskModel.create({ title: 'Archived project task', priority: 'must', projectId: archived._id });
    await TaskModel.create({ title: 'Production-ready project task', priority: 'must', projectId: productionReady._id });

    const result = await executeGoodMorning({ ...models, now: new Date('2026-06-26T08:00:00.000Z') });

    expect(result.dayPlan.carriedForwardItems).toEqual(['Active project task']);
    expect(result.tasks.created.map((task) => task.title)).toEqual([]);
  });

  test('good morning ignores closed, completed, archived, dismissed, and converted tasks', async () => {
    await TaskModel.create({ title: 'Closed task', status: 'closed' });
    await TaskModel.create({ title: 'Completed task', status: 'completed' });
    await TaskModel.create({ title: 'Archived task', status: 'archived' });
    await TaskModel.create({ title: 'Dismissed task', status: 'dismissed' });
    await TaskModel.create({ title: 'Converted task', status: 'converted' });
    await TaskModel.create({ title: 'Open task', status: 'open' });

    const result = await executeGoodMorning({ ...models, now: new Date('2026-06-26T08:00:00.000Z') });

    expect(result.dayPlan.carriedForwardItems).toEqual(['Open task']);
  });

  test('good morning respects Preference.planning.maxDailyTasks', async () => {
    await PreferenceModel.create({ active: true, planning: { maxDailyTasks: 2 } });
    await TaskModel.create({ title: 'Task one', priority: 'must' });
    await TaskModel.create({ title: 'Task two', priority: 'must' });
    await TaskModel.create({ title: 'Task three', priority: 'must' });

    const result = await executeGoodMorning({ ...models, now: new Date('2026-06-26T08:00:00.000Z') });

    expect(result.dayPlan.carriedForwardItems).toHaveLength(2);
    expect(result.dayPlan.unclearItems[0]).toContain('exceeds the preference of 2 daily tasks');
  });

  test('good morning prevents duplicate scheduled tasks by normalized title and London date', async () => {
    await TaskModel.create({
      title: 'Draft launch checklist',
      priority: 'must',
      scheduledFor: new Date('2026-06-26T00:00:00.000Z'),
      scheduledLondonDate: '2026-06-26',
    });

    const result = await executeGoodMorning({ ...models, now: new Date('2026-06-26T08:00:00.000Z') });

    expect(TaskModel.all().filter((task) => task.normalizedTitle === normalizeTaskTitle('Draft launch checklist'))).toHaveLength(1);
    expect(result.counts.tasksCreated).toBe(0);
  });

  test('good morning reads active goals and latest brain update report into context', async () => {
    await GoalModel.create({ title: 'Ship Brain MVP', status: 'active' });
    await BrainUpdateReportModel.create({ status: 'success', runDate: new Date('2026-06-25T22:00:00.000Z'), summary: 'Yesterday clarified command boundaries.' });

    const result = await executeGoodMorning({ ...models, now: new Date('2026-06-26T08:00:00.000Z') });

    expect(result.dayPlan.forgotten).toContain('Active goal: Ship Brain MVP');
    expect(result.dayPlan.forgotten).toContain('Latest brain update: Yesterday clarified command boundaries.');
  });

  test('replan day requires an active day plan', async () => {
    await expect(executeReplanDay({ ...models, now: new Date('2026-06-26T12:00:00.000Z') }))
      .rejects.toThrow('No active day plan found to restart');
  });

  test('replan day restarts the active plan and keeps one active replacement', async () => {
    const first = await executeGoodMorning({ ...models, now: new Date('2026-06-26T08:00:00.000Z') });

    const result = await executeReplanDay({ ...models, now: new Date('2026-06-26T12:00:00.000Z') });

    expect(result.command).toBe('replan-day');
    expect(result.dayPlan.sessionType).toBe('restart');
    expect(String(result.dayPlan.sourcePlanId)).toBe(String(first.dayPlan._id));
    expect(DayPlanModel.all().filter((plan) => plan.status === 'active')).toHaveLength(1);
    expect(DayPlanModel.all().find((plan) => plan._id === first.dayPlan._id).status).toBe('restarted');
  });

  test('update brain creates one report and zero day plans', async () => {
    await NoteModel.create({ content: 'Idea: build a weekly planning report' });

    const result = await executeUpdateBrain({ ...models, now: new Date('2026-06-26T22:00:00.000Z') });

    expect(result.command).toBe('update-brain');
    expect(result.counts.reportsCreated).toBe(1);
    expect(result.counts.dayPlansCreated).toBe(0);
    expect(BrainUpdateReportModel.all()).toHaveLength(1);
    expect(DayPlanModel.all()).toHaveLength(0);
    expect(IdeaModel.all()).toHaveLength(1);
    expect(NoteModel.all()).toHaveLength(1);
  });

  test('update brain does not create, update, or delete day plans', async () => {
    const existing = await DayPlanModel.create({
      date: new Date('2026-06-26T08:00:00.000Z'),
      londonDate: '2026-06-26',
      status: 'active',
      sessionType: 'start',
      priorities: [],
      schedule: [],
      mustDo: [],
      shouldDo: [],
      niceToHave: [],
      unclearItems: [],
    });
    await NoteModel.create({ content: 'Context: protect the command boundary.' });

    await executeUpdateBrain({ ...models, now: new Date('2026-06-26T22:00:00.000Z') });

    const plans = DayPlanModel.all();
    expect(plans).toHaveLength(1);
    expect(plans[0]._id).toBe(existing._id);
    expect(plans[0].status).toBe('active');
    expect(plans[0].updatedAt).toEqual(existing.updatedAt);
  });

  test('refresh brain updates memory first, then creates a day plan when no active plan exists', async () => {
    const order = [];
    await NoteModel.create({ content: 'Task: Write early morning launch notes' });

    const result = await executeRefreshBrain({
      ...models,
      now: new Date('2026-06-26T06:00:00.000Z'),
      executeUpdateBrain: async (options) => {
        order.push('memory');
        return executeUpdateBrain(options);
      },
    });

    order.push('complete');
    expect(result.command).toBe('refresh-brain');
    expect(result.status).toBe('success');
    expect(order).toEqual(['memory', 'complete']);
    expect(result.dayPlan.sessionType).toBe('start');
    expect(DayPlanModel.all().filter((plan) => plan.status === 'active')).toHaveLength(1);
    expect(result.dayPlan.carriedForwardItems).toContain('Task: Write early morning launch notes');
    expect(result.counts.reportsCreated).toBe(1);
    expect(result.counts.dayPlansCreated).toBe(1);
  });

  test('refresh brain updates memory first, then restarts an existing active day plan', async () => {
    const first = await executeGoodMorning({ ...models, now: new Date('2026-06-26T05:30:00.000Z') });
    await NoteModel.create({ content: 'Task: Write refreshed personal summary' });

    const result = await executeRefreshBrain({ ...models, now: new Date('2026-06-26T06:00:00.000Z') });

    expect(result.command).toBe('refresh-brain');
    expect(result.status).toBe('success');
    expect(result.dayPlan.sessionType).toBe('restart');
    expect(String(result.dayPlan.sourcePlanId)).toBe(String(first.dayPlan._id));
    expect(result.ids.sourcePlanId).toBe(String(first.dayPlan._id));
    expect(result.sourcePlan._id).toBe(first.dayPlan._id);
    expect(DayPlanModel.all().filter((plan) => plan.status === 'active')).toHaveLength(1);
    expect(DayPlanModel.all().find((plan) => plan._id === first.dayPlan._id).status).toBe('restarted');
    expect(result.dayPlan.carriedForwardItems).toContain('Task: Write refreshed personal summary');
  });

  test('refresh brain includes newly created memory tasks in the refreshed plan context', async () => {
    await NoteModel.create({ content: 'Task: Write invoice reminder automation' });

    const result = await executeRefreshBrain({ ...models, now: new Date('2026-06-26T06:00:00.000Z') });

    expect(TaskModel.all().map((task) => task.title)).toContain('Task: Write invoice reminder automation');
    expect(result.dayPlan.carriedForwardItems).toContain('Task: Write invoice reminder automation');
  });

  test('refresh brain returns failed and does not create or restart day plans when memory update fails', async () => {
    const result = await executeRefreshBrain({
      ...models,
      now: new Date('2026-06-26T06:00:00.000Z'),
      executeUpdateBrain: async () => ({
        command: 'update-brain',
        status: 'failed',
        ids: { brainUpdateReportId: 'brainUpdateReport-failed' },
        warnings: ['memory warning'],
        errors: ['memory failed'],
        counts: { reportsCreated: 1, recordsCreated: 0, recordsUpdated: 0, skipped: 0, dayPlansCreated: 0 },
        report: { _id: 'brainUpdateReport-failed', status: 'failed' },
      }),
    });

    expect(result.status).toBe('failed');
    expect(result.ids.brainUpdateReportId).toBe('brainUpdateReport-failed');
    expect(result.warnings).toContain('memory warning');
    expect(result.errors).toContain('memory failed');
    expect(DayPlanModel.all()).toHaveLength(0);
  });

  test('refresh brain result includes combined brain, day plan, and task counts', async () => {
    await NoteModel.create({ content: 'Idea: write refresh command release note' });
    await TaskModel.create({ title: 'Implement refresh command', priority: 'must' });

    const result = await executeRefreshBrain({ ...models, now: new Date('2026-06-26T06:00:00.000Z') });

    expect(result.counts).toMatchObject({
      reportsCreated: 1,
      recordsCreated: 1,
      recordsUpdated: 0,
      skipped: 0,
      dayPlansCreated: 1,
      dayPlansRestarted: 0,
      tasksCreated: 0,
      tasksUpdated: 1,
      tasksReused: 0,
    });
  });

  test('command script runners can execute command services without crashing', async () => {
    const calls = [];
    const dependencies = (command) => ({
      connect: async () => calls.push(`${command}:connect`),
      disconnect: async () => calls.push(`${command}:disconnect`),
      execute: async () => ({ command, status: 'success', ids: {}, warnings: [], errors: [], counts: {} }),
      log: () => {},
      errorLog: () => {},
    });

    await expect(runGoodMorningCommandScript(dependencies('good-morning'))).resolves.toMatchObject({ command: 'good-morning', status: 'success' });
    await expect(runReplanDayCommandScript(dependencies('replan-day'))).resolves.toMatchObject({ command: 'replan-day', status: 'success' });
    await expect(runRefreshBrainCommandScript(dependencies('refresh-brain'))).resolves.toMatchObject({ command: 'refresh-brain', status: 'success' });
    await expect(runUpdateBrainCommandScript(dependencies('update-brain'))).resolves.toMatchObject({ command: 'update-brain', status: 'success' });
    expect(calls).toEqual([
      'good-morning:connect',
      'good-morning:disconnect',
      'replan-day:connect',
      'replan-day:disconnect',
      'refresh-brain:connect',
      'refresh-brain:disconnect',
      'update-brain:connect',
      'update-brain:disconnect',
    ]);
  });

  test('refresh brain script logs JSON, disconnects, and sets exit code on failure', async () => {
    const calls = [];
    const logs = [];
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    const result = await runRefreshBrainCommandScript({
      connect: async () => calls.push('connect'),
      disconnect: async () => calls.push('disconnect'),
      execute: async () => ({ command: 'refresh-brain', status: 'failed', errors: ['bad refresh'] }),
      log: (message) => logs.push(message),
      errorLog: () => {},
    });

    expect(result.status).toBe('failed');
    expect(calls).toEqual(['connect', 'disconnect']);
    expect(JSON.parse(logs[0])).toMatchObject({ command: 'refresh-brain', status: 'failed' });
    expect(process.exitCode).toBe(1);
    process.exitCode = previousExitCode;
  });
});
