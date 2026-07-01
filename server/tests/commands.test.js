import { beforeEach, describe, expect, test } from '@jest/globals';
import { executeGoodMorning, executeReplanDay, executeUpdateBrain } from '../services/commands/index.js';
import { normalizeTaskTitle } from '../services/taskNormalization.js';

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
});
