import { describe, expect, test, beforeEach } from '@jest/globals';
import { upsertTodaysDayPlan } from '../services/dayPlanUpsert.js';
import { normalizeTaskTitle } from '../services/taskNormalization.js';

let tick = 0;

function nextTimestamp() {
  tick += 1000;
  return new Date(Date.UTC(2026, 5, 25, 8, 0, 0, tick));
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
      if ('$gte' in expected && new Date(actual) < new Date(expected.$gte)) return false;
      if ('$lt' in expected && new Date(actual) >= new Date(expected.$lt)) return false;
      if ('$in' in expected) return expected.$in.includes(actual);
      return true;
    }

    return actual === expected;
  });
}

function sortRecords(records, sort = {}) {
  const [[field, direction] = []] = Object.entries(sort);
  if (!field) return records;

  return [...records].sort((left, right) => {
    const leftValue = valueAtPath(left, field);
    const rightValue = valueAtPath(right, field);
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });
}

function fakeModel(name, normalizer = (payload) => payload) {
  let records = [];

  return class FakeModel {
    static reset() {
      records = [];
    }

    static all() {
      return records.map(clone);
    }

    static async create(payload) {
      const now = nextTimestamp();
      const item = {
        _id: `${name}-${records.length + 1}`,
        ...normalizer(payload),
        createdAt: now,
        updatedAt: now,
      };
      records.push(item);
      return clone(item);
    }

    static find(query = {}) {
      return {
        sort: async (sort) => sortRecords(records.filter((item) => matchesQuery(item, query)), sort).map(clone),
      };
    }

    static findOne(query = {}) {
      return {
        sort: async (sort) => clone(sortRecords(records.filter((item) => matchesQuery(item, query)), sort)[0] || null),
      };
    }

    static async findByIdAndUpdate(id, payload) {
      const index = records.findIndex((item) => item._id === id);
      if (index === -1) return null;
      records[index] = {
        ...records[index],
        ...normalizer(payload),
        createdAt: records[index].createdAt,
        updatedAt: nextTimestamp(),
      };
      return clone(records[index]);
    }
  };
}

const normalizeTask = (payload) => ({
  status: 'open',
  completedAt: null,
  ...payload,
  normalizedTitle: payload.normalizedTitle || normalizeTaskTitle(payload.title),
});

const DayPlanModel = fakeModel('dayPlan');
const TaskModel = fakeModel('task', normalizeTask);
const ProjectModel = fakeModel('project', (payload) => ({ status: 'active', ...payload }));

beforeEach(() => {
  tick = 0;
  DayPlanModel.reset();
  TaskModel.reset();
  ProjectModel.reset();
});

describe('upsertTodaysDayPlan', () => {
  test('running update twice leaves one DayPlan for today', async () => {
    await upsertTodaysDayPlan({ focus: 'First plan', mustDo: ['Ship one thing'] }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    await upsertTodaysDayPlan({ focus: 'Second plan', mustDo: ['Ship one thing'] }, {
      now: new Date('2026-06-25T16:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    expect(DayPlanModel.all()).toHaveLength(1);
    expect(DayPlanModel.all()[0].focus).toBe('Second plan');
    expect(DayPlanModel.all()[0].londonDate).toBe('2026-06-25');
  });

  test('second update preserves createdAt and changes updatedAt', async () => {
    const first = await upsertTodaysDayPlan({ focus: 'First', mustDo: ['Draft proposal'] }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    const second = await upsertTodaysDayPlan({ focus: 'Second', mustDo: ['Draft proposal'] }, {
      now: new Date('2026-06-25T18:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    expect(second.dayPlan._id).toBe(first.dayPlan._id);
    expect(second.dayPlan.createdAt).toEqual(first.dayPlan.createdAt);
    expect(second.dayPlan.updatedAt.getTime()).toBeGreaterThan(first.dayPlan.updatedAt.getTime());
  });

  test('tasks from plan are created once', async () => {
    const options = {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    };

    await upsertTodaysDayPlan({ mustDo: ['Call accountant'], shouldDo: ['Review invoices'] }, options);
    await upsertTodaysDayPlan({ mustDo: ['Call accountant'], shouldDo: ['Review invoices'] }, options);

    expect(TaskModel.all().map((task) => task.title).sort()).toEqual(['Call accountant', 'Review invoices']);
  });

  test('marks deliverables only when the plan item has a clear output', async () => {
    await upsertTodaysDayPlan({
      mustDo: ['Call accountant'],
      deliverables: ['Draft client proposal'],
    }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    const normalTask = TaskModel.all().find((task) => task.title === 'Call accountant');
    const deliverableTask = TaskModel.all().find((task) => task.title === 'Draft client proposal');

    expect(normalTask.deliverableRequired).toBe(false);
    expect(normalTask.expectedDeliverable).toBe('');
    expect(deliverableTask.deliverableRequired).toBe(true);
    expect(deliverableTask.expectedDeliverable).toBe('Draft client proposal');
    expect(deliverableTask.deliverableSummary).toBe('');
    expect(deliverableTask.deliverableLocation).toBe('');
  });

  test('generates copy-paste-ready Codex prompts for agent-executable tasks', async () => {
    await upsertTodaysDayPlan({
      mustDo: [{
        title: 'Implement task prompt generation',
        description: 'Add automatic agent prompts to generated task workspaces.',
        expectedDeliverable: 'Planner-created tasks include useful codexPrompt text.',
        acceptanceCriteria: ['Agent-ready tasks get prompts.', 'Physical tasks stay empty.'],
        projectName: 'Brain OS',
        projectSummary: 'Personal operating system for planning and task execution.',
      }],
    }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    const task = TaskModel.all()[0];

    expect(task.agentReady).toBe(true);
    expect(task.codexPrompt).toContain('Implement the following task.');
    expect(task.codexPrompt).toContain('Objective:\nImplement task prompt generation');
    expect(task.codexPrompt).toContain('Expected Output:\nPlanner-created tasks include useful codexPrompt text.');
    expect(task.codexPrompt).toContain('Existing Project Context:\n- Project: Brain OS');
    expect(task.codexPrompt).toContain('- Inspect the repository before making changes.');
    expect(task.codexPrompt).toContain('- Run the relevant test/build commands.');
  });

  test('leaves codexPrompt empty when no useful AI execution prompt can be generated', async () => {
    await upsertTodaysDayPlan({ mustDo: ['Call accountant'] }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    const task = TaskModel.all()[0];

    expect(task.agentReady).toBe(false);
    expect(task.codexPrompt).toBe('');
  });

  test('matching tasks are reused, not duplicated', async () => {
    const existing = await TaskModel.create({
      title: 'Call Laura!!!',
      dueDate: new Date('2026-06-24T23:00:00.000Z'),
      priority: 'low',
      source: 'manual',
    });

    await upsertTodaysDayPlan({ mustDo: ['call laura'] }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    expect(TaskModel.all()).toHaveLength(1);
    expect(TaskModel.all()[0]._id).toBe(existing._id);
    expect(TaskModel.all()[0].priority).toBe('must');
  });

  test('equivalent open tasks are reused even without today schedule metadata', async () => {
    const existing = await TaskModel.create({
      title: 'Draft launch checklist',
      notes: 'Preserve workspace notes',
      codexPrompt: 'Preserve agent context',
      priority: 'should',
      source: 'manual',
    });

    await upsertTodaysDayPlan({ mustDo: ['Draft launch checklist'] }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    expect(TaskModel.all()).toHaveLength(1);
    expect(TaskModel.all()[0]._id).toBe(existing._id);
    expect(TaskModel.all()[0].notes).toBe('Preserve workspace notes');
    expect(TaskModel.all()[0].codexPrompt).toBe('Preserve agent context');
    expect(TaskModel.all()[0].scheduledLondonDate).toBe('2026-06-25');
    expect(TaskModel.all()[0].priority).toBe('must');
  });

  test('refreshes stale planner-generated prompts while preserving manual prompts', async () => {
    await TaskModel.create({
      title: 'Write project brief',
      codexPrompt: [
        'Implement the following task.',
        '',
        'Objective:',
        'Write project brief',
        '',
        'Context:',
        'Old generated context.',
      ].join('\n'),
      source: 'day-plan',
    });
    await TaskModel.create({
      title: 'Write launch article',
      codexPrompt: 'Manual prompt: keep this exact instruction.',
      source: 'manual',
    });

    await upsertTodaysDayPlan({
      mustDo: [
        {
          title: 'Write project brief',
          description: 'Draft the updated project brief from current planning context.',
          expectedDeliverable: 'A refreshed project brief draft.',
        },
        {
          title: 'Write launch article',
          description: 'Draft the launch article.',
          expectedDeliverable: 'Launch article draft.',
        },
      ],
    }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    const refreshed = TaskModel.all().find((task) => task.title === 'Write project brief');
    const manual = TaskModel.all().find((task) => task.title === 'Write launch article');

    expect(refreshed.codexPrompt).toContain('Context:\nDraft the updated project brief from current planning context.');
    expect(refreshed.codexPrompt).toContain('Expected Output:\nA refreshed project brief draft.');
    expect(manual.codexPrompt).toBe('Manual prompt: keep this exact instruction.');
  });

  test('unrelated open tasks remain untouched', async () => {
    const unrelated = await TaskModel.create({
      title: 'Unrelated admin',
      dueDate: new Date('2026-06-24T23:00:00.000Z'),
      dueLondonDate: '2026-06-25',
      priority: 'should',
      source: 'manual',
    });

    await upsertTodaysDayPlan({ mustDo: ['Write project brief'] }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    const untouched = TaskModel.all().find((task) => task._id === unrelated._id);
    expect(untouched.source).toBe('manual');
    expect(untouched.updatedAt).toEqual(unrelated.updatedAt);
    expect(TaskModel.all()).toHaveLength(2);
  });

  test('completed matching tasks are reused without reopening', async () => {
    await TaskModel.create({
      title: 'Finish workout',
      status: 'complete',
      completedAt: new Date('2026-06-25T07:00:00.000Z'),
      dueDate: new Date('2026-06-24T23:00:00.000Z'),
      dueLondonDate: '2026-06-25',
      priority: 'must',
      source: 'manual',
    });

    await upsertTodaysDayPlan({ mustDo: ['finish workout'] }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    expect(TaskModel.all()).toHaveLength(1);
    expect(TaskModel.all()[0].status).toBe('complete');
    expect(TaskModel.all()[0].completedAt).toEqual(new Date('2026-06-25T07:00:00.000Z'));
  });

  test('dismissed matching tasks are reused without recreating generated work', async () => {
    await TaskModel.create({
      title: 'Bad generated task',
      status: 'dismissed',
      outcome: 'dismissed',
      dismissedReason: 'generated_incorrectly',
      dismissedAt: new Date('2026-06-24T08:00:00.000Z'),
      priority: 'must',
      source: 'day-plan',
    });

    const result = await upsertTodaysDayPlan({ mustDo: ['Bad generated task'] }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
      ProjectModel,
    });

    expect(TaskModel.all()).toHaveLength(1);
    expect(TaskModel.all()[0].status).toBe('dismissed');
    expect(result.tasks.created).toHaveLength(0);
    expect(result.tasks.reused).toHaveLength(1);
  });

  test('inactive projects suppress future generated tasks', async () => {
    const project = await ProjectModel.create({ name: 'Abandoned project', status: 'inactive' });

    const result = await upsertTodaysDayPlan({
      mustDo: [{ title: 'Suppressed project task', projectId: project._id }],
    }, {
      now: new Date('2026-06-25T10:00:00.000Z'),
      DayPlanModel,
      TaskModel,
      ProjectModel,
    });

    expect(result.tasks.created).toHaveLength(0);
    expect(TaskModel.all()).toHaveLength(0);
  });

  test('uses Europe/London day boundaries', async () => {
    await DayPlanModel.create({
      date: new Date('2026-06-24T22:30:00.000Z'),
      londonDate: '2026-06-24',
      focus: 'Late June 24 London plan',
    });

    await upsertTodaysDayPlan({ focus: 'Just after London midnight', mustDo: ['Sleep'] }, {
      now: new Date('2026-06-24T23:30:00.000Z'),
      DayPlanModel,
      TaskModel,
    });

    expect(DayPlanModel.all()).toHaveLength(2);
    expect(DayPlanModel.all().map((plan) => plan.londonDate).sort()).toEqual(['2026-06-24', '2026-06-25']);
    expect(DayPlanModel.all().find((plan) => plan.londonDate === '2026-06-25').date)
      .toEqual(new Date('2026-06-24T23:00:00.000Z'));
  });
});
