import request from 'supertest';
import { jest } from '@jest/globals';

function fakeModel(name) {
  let records = [];
  const clone = (item) => (item ? { ...item } : item);
  const valueAtPath = (item, path) => path.split('.').reduce((current, key) => current?.[key], item);
  const matchesQuery = (item, query = {}) => Object.entries(query).every(([key, expected]) => {
    const actual = valueAtPath(item, key);
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$nin' in expected) return !expected.$nin.includes(actual);
      if ('$gte' in expected && new Date(actual) < new Date(expected.$gte)) return false;
      if ('$lt' in expected && new Date(actual) >= new Date(expected.$lt)) return false;
      return true;
    }
    return actual === expected;
  });
  const sortRecords = (items, sort = {}) => [...items].sort((left, right) => {
    for (const [field, direction] of Object.entries(sort)) {
      const leftValue = valueAtPath(left, field);
      const rightValue = valueAtPath(right, field);
      if (leftValue === rightValue) continue;
      if ((leftValue === undefined || leftValue === null) && (rightValue === undefined || rightValue === null)) continue;
      if (leftValue === undefined || leftValue === null) return 1;
      if (rightValue === undefined || rightValue === null) return -1;
      return (leftValue < rightValue ? -1 : 1) * direction;
    }
    return 0;
  });
  return class FakeModel {
    static modelName = name;
    static reset() { records = []; }
    static normalize(payload) {
      if (name === 'project') {
        const next = {
          progressPercent: 0,
          priority: 'medium',
          focusToday: false,
          executionState: 'planning',
          blockers: [],
          productionChecklist: [],
          nextActionableSteps: [],
          progressUpdates: [],
          ...payload,
        };
        if (!['low', 'medium', 'high'].includes(next.priority)) {
          const error = new Error(`Project validation failed: priority: \`${next.priority}\` is not a valid enum value`);
          error.name = 'ValidationError';
          throw error;
        }
        if (!['planning', 'in_progress', 'blocked', 'review_required', 'ready_for_production', 'completed'].includes(next.executionState)) {
          const error = new Error(`Project validation failed: executionState: \`${next.executionState}\` is not a valid enum value`);
          error.name = 'ValidationError';
          throw error;
        }
        next.progressPercent = Math.max(0, Math.min(100, Number(next.progressPercent) || 0));
        return next;
      }
      if (name !== 'task') return payload;
      const next = {
        category: 'general',
        agentReady: false,
        status: 'open',
        reviewRequired: false,
        reviewStatus: 'pending',
        ...payload,
      };
      if (!['projects', 'family', 'personal', 'admin', 'general'].includes(next.category)) {
        const error = new Error(`Task validation failed: category: \`${next.category}\` is not a valid enum value`);
        error.name = 'ValidationError';
        throw error;
      }
      return next;
    }
    static async create(payload) {
      const normalizedPayload = this.normalize(payload);
      const item = { _id: `${name}-${records.length + 1}`, status: normalizedPayload.status || undefined, ...normalizedPayload, createdAt: new Date(), updatedAt: new Date() };
      records.push(item);
      return clone(item);
    }
    static find(query = {}) { return { sort: async (sort) => sortRecords(records.filter((item) => matchesQuery(item, query)), sort).map(clone) }; }
    static async findById(id) { return records.find((item) => item._id === id) || null; }
    static async findByIdAndUpdate(id, payload) {
      const index = records.findIndex((item) => item._id === id);
      if (index === -1) return null;
      const normalizedPayload = this.normalize({ ...records[index], ...payload });
      records[index] = { ...records[index], ...normalizedPayload, updatedAt: new Date() };
      return clone(records[index]);
    }
    static async findByIdAndDelete(id) {
      const index = records.findIndex((item) => item._id === id);
      if (index === -1) return null;
      const [removed] = records.splice(index, 1);
      return clone(removed);
    }
    static findOne(query = {}) { return { sort: async (sort) => clone(sortRecords(records.filter((item) => matchesQuery(item, query)), sort)[0] || null) }; }
  };
}

const Note = fakeModel('note');
const Task = fakeModel('task');
const Deliverable = fakeModel('deliverable');
const Goal = fakeModel('goal');
const Project = fakeModel('project');
const Idea = fakeModel('idea');
const Context = fakeModel('context');
const Review = fakeModel('review');
const DayPlan = fakeModel('dayPlan');

jest.unstable_mockModule('../models/Note.js', () => ({ Note }));
jest.unstable_mockModule('../models/Task.js', () => ({ Task }));
jest.unstable_mockModule('../models/Deliverable.js', () => ({ Deliverable }));
jest.unstable_mockModule('../models/Goal.js', () => ({ Goal }));
jest.unstable_mockModule('../models/Project.js', () => ({ Project }));
jest.unstable_mockModule('../models/Idea.js', () => ({ Idea }));
jest.unstable_mockModule('../models/Context.js', () => ({ Context }));
jest.unstable_mockModule('../models/Review.js', () => ({ Review }));
jest.unstable_mockModule('../models/DayPlan.js', () => ({ DayPlan }));

const { createApp } = await import('../app.js');
const app = createApp();

beforeEach(() => [Note, Task, Deliverable, Goal, Project, Idea, Context, Review, DayPlan].forEach((model) => model.reset()));

describe('notes CRUD', () => {
  test('creates, lists, updates, reads, and deletes notes', async () => {
    const created = await request(app).post('/api/notes').send({ content: 'Capture an idea' }).expect(201);
    expect(created.body.content).toBe('Capture an idea');
    expect((await request(app).get('/api/notes').expect(200)).body).toHaveLength(1);
    expect((await request(app).patch(`/api/notes/${created.body._id}`).send({ content: 'Updated note' }).expect(200)).body.content).toBe('Updated note');
    await request(app).get(`/api/notes/${created.body._id}`).expect(200);
    await request(app).delete(`/api/notes/${created.body._id}`).expect(204);
    await request(app).get(`/api/notes/${created.body._id}`).expect(404);
  });
});

describe('task completion', () => {
  test('completes and reopens a task', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Ship Brain OS' }).expect(201);
    expect((await request(app).patch(`/api/tasks/${created.body._id}/complete`).expect(200)).body.status).toBe('complete');
    const reopened = await request(app).patch(`/api/tasks/${created.body._id}/reopen`).expect(200);
    expect(reopened.body.status).toBe('open');
    expect(reopened.body.completedAt).toBeNull();
  });

  test('defaults task category and agent readiness', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Default task' }).expect(201);
    expect(created.body.category).toBe('general');
    expect(created.body.agentReady).toBe(false);
  });

  test('creates and updates task category and agent readiness', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Codex task', category: 'projects', agentReady: true })
      .expect(201);

    expect(created.body.category).toBe('projects');
    expect(created.body.agentReady).toBe(true);

    const updated = await request(app)
      .patch(`/api/tasks/${created.body._id}`)
      .send({ category: 'family', agentReady: false })
      .expect(200);

    expect(updated.body.category).toBe('family');
    expect(updated.body.agentReady).toBe(false);
  });

  test('creates a task linked to a project actionable step', async () => {
    const project = await request(app)
      .post('/api/projects')
      .send({ name: 'Brain OS project', nextActionableSteps: [{ title: 'Ship execution loop' }] })
      .expect(201);

    const created = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Ship execution loop',
        projectId: project.body._id,
        projectActionId: '656f0f0f0f0f0f0f0f0f0f0f',
        codexPrompt: 'Implement the execution loop',
        reviewRequired: true,
      })
      .expect(201);

    expect(created.body.projectId).toBe(project.body._id);
    expect(created.body.projectActionId).toBe('656f0f0f0f0f0f0f0f0f0f0f');
    expect(created.body.codexPrompt).toBe('Implement the execution loop');
    expect(created.body.reviewRequired).toBe(true);
    expect(created.body.reviewStatus).toBe('pending');
  });

  test('rejects invalid task categories', async () => {
    await request(app)
      .post('/api/tasks')
      .send({ title: 'Bad category', category: 'invalid' })
      .expect(400);
  });
});

describe('projects CRUD', () => {
  test('creates and updates project execution fields', async () => {
    const created = await request(app)
      .post('/api/projects')
      .send({
        name: 'Project execution loop',
        problemStatement: 'Projects need executable state',
        vision: 'Codex-ready project plans',
        prd: 'Store PRD context in MongoDB',
        definitionOfDone: 'CRUD UI and saved actionable steps',
        summary: 'Execution state captured',
        progressPercent: 25,
        priority: 'high',
        focusToday: true,
        executionState: 'in_progress',
        blockers: ['Need tests'],
        agentPrompt: 'Use project context',
        productionReadiness: 'Needs manual review',
        productionChecklist: [{ title: 'Tests pass', done: false }],
        nextActionableSteps: [{
          title: 'Build custom Projects page',
          done: false,
          priority: 'high',
          codexPrompt: 'Replace generic Projects page',
          reviewRequired: true,
        }],
        progressUpdates: [{
          progressPercent: 10,
          summary: 'Started implementation',
          nextActionableSteps: ['Build UI'],
          blockers: ['None'],
        }],
      })
      .expect(201);

    expect(created.body.priority).toBe('high');
    expect(created.body.focusToday).toBe(true);
    expect(created.body.nextActionableSteps[0].codexPrompt).toBe('Replace generic Projects page');
    expect(created.body.productionChecklist[0].title).toBe('Tests pass');

    const updated = await request(app)
      .patch(`/api/projects/${created.body._id}`)
      .send({
        progressPercent: 75,
        executionState: 'review_required',
        blockers: [],
        nextActionableSteps: [{ title: 'Manual review', done: false, priority: 'medium' }],
      })
      .expect(200);

    expect(updated.body.progressPercent).toBe(75);
    expect(updated.body.executionState).toBe('review_required');
    expect(updated.body.blockers).toEqual([]);
    expect(updated.body.nextActionableSteps[0].title).toBe('Manual review');
  });
});

describe('latest day plan endpoint', () => {
  test('returns the newest day plan by date', async () => {
    await request(app).post('/api/day-plans').send({ date: '2026-06-22', focus: 'Yesterday' }).expect(201);
    await request(app).post('/api/day-plans').send({ date: '2026-06-23', focus: 'Today' }).expect(201);
    expect((await request(app).get('/api/day-plans/latest').expect(200)).body.focus).toBe('Today');
  });

  test('returns active plan before more recent inactive plan', async () => {
    await request(app).post('/api/day-plans').send({
      date: '2026-06-26T08:00:00.000Z',
      startTime: '2026-06-26T08:00:00.000Z',
      status: 'active',
      focus: 'Active session',
    }).expect(201);
    await request(app).post('/api/day-plans').send({
      date: '2026-06-26T12:00:00.000Z',
      startTime: '2026-06-26T12:00:00.000Z',
      status: 'completed',
      focus: 'Completed session',
    }).expect(201);

    expect((await request(app).get('/api/day-plans/latest').expect(200)).body.focus).toBe('Active session');
  });

  test('legacy day plans without session fields still work', async () => {
    await request(app).post('/api/day-plans').send({ date: '2026-06-22', focus: 'Legacy' }).expect(201);
    const latest = await request(app).get('/api/day-plans/latest').expect(200);

    expect(latest.body.focus).toBe('Legacy');
    expect(latest.body.status).toBeUndefined();
  });
});

describe('day plan sessions', () => {
  test('start day creates a plan from now to now plus 8 hours', async () => {
    const now = '2026-06-26T13:15:00.000Z';
    const response = await request(app).post('/api/day-plans/start').send({ now }).expect(201);

    expect(response.body.startTime).toBe(now);
    expect(response.body.endTime).toBe('2026-06-26T21:15:00.000Z');
    expect(response.body.status).toBe('active');
    expect(response.body.sessionType).toBe('start');
  });

  test('restart day finds the active plan and creates a restarted plan', async () => {
    const active = await request(app).post('/api/day-plans/start').send({ now: '2026-06-26T08:00:00.000Z' }).expect(201);
    const restarted = await request(app).post('/api/day-plans/restart').send({ now: '2026-06-26T12:30:00.000Z' }).expect(201);

    expect(restarted.body.startTime).toBe('2026-06-26T12:30:00.000Z');
    expect(restarted.body.endTime).toBe('2026-06-26T20:30:00.000Z');
    expect(restarted.body.status).toBe('active');
    expect(restarted.body.sessionType).toBe('restart');
    expect(restarted.body.sourcePlanId).toBe(active.body._id);
    expect((await request(app).get(`/api/day-plans/${active.body._id}`).expect(200)).body.status).toBe('restarted');
  });

  test('completed items are excluded from restarted plans', async () => {
    await request(app).post('/api/tasks').send({ title: 'Already done', status: 'complete', priority: 'must' }).expect(201);
    await request(app).post('/api/tasks').send({ title: 'Carry forward', status: 'open', priority: 'must' }).expect(201);
    await request(app).post('/api/day-plans').send({
      date: '2026-06-26T08:00:00.000Z',
      startTime: '2026-06-26T08:00:00.000Z',
      endTime: '2026-06-26T16:00:00.000Z',
      status: 'active',
      sessionType: 'start',
      mustDo: ['Already done', 'Carry forward'],
    }).expect(201);

    const restarted = await request(app).post('/api/day-plans/restart').send({ now: '2026-06-26T12:00:00.000Z' }).expect(201);

    expect(restarted.body.mustDo).toContain('Carry forward');
    expect(restarted.body.mustDo).not.toContain('Already done');
    expect(restarted.body.carriedForwardItems).toContain('Carry forward');
    expect(restarted.body.carriedForwardItems).not.toContain('Already done');
    expect(restarted.body.completedItems).toContain('Already done');
  });

  test('multiple plans can exist on the same londonDate', async () => {
    await request(app).post('/api/day-plans/start').send({ now: '2026-06-26T08:00:00.000Z' }).expect(201);
    await request(app).post('/api/day-plans/start').send({ now: '2026-06-26T14:00:00.000Z' }).expect(201);

    const plans = await request(app).get('/api/day-plans').expect(200);
    expect(plans.body).toHaveLength(2);
    expect(plans.body.map((plan) => plan.londonDate)).toEqual(['2026-06-26', '2026-06-26']);
  });
});

describe('forbidden AI endpoints', () => {
  test('does not expose brain pipeline endpoints', async () => {
    await request(app).post('/api/update-life').send({}).expect(404);
    await request(app).post('/api/plan-day').send({}).expect(404);
    await request(app).post('/api/brain/update-life').send({}).expect(404);
  });
});

describe('CORS', () => {
  const deployedOrigin = 'https://brain-92pysn6ss-kofi-arhins-projects.vercel.app';

  test.each([
    'http://localhost:5173',
    'https://brain-pi-black.vercel.app',
    deployedOrigin,
    'https://brain-feature-123.vercel.app',
    'https://brain-feature-123-kofi-arhins-projects.vercel.app',
  ])('allows requests from %s', async (origin) => {
    const response = await request(app).get('/api/health').set('Origin', origin).expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });

  test('allows the configured CLIENT_URL', async () => {
    const previousClientUrl = process.env.CLIENT_URL;
    process.env.CLIENT_URL = 'https://brain-custom.example.com/';

    try {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://brain-custom.example.com')
        .expect(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://brain-custom.example.com');
    } finally {
      if (previousClientUrl === undefined) delete process.env.CLIENT_URL;
      else process.env.CLIENT_URL = previousClientUrl;
    }
  });

  test('handles preflight requests', async () => {
    const response = await request(app)
      .options('/api/tasks')
      .set('Origin', deployedOrigin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(deployedOrigin);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toBe('Content-Type,Authorization');
  });

  test('does not add an allow-origin header for untrusted origins', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://example.com')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('adds the allow-origin header to 404 responses', async () => {
    const response = await request(app)
      .get('/api/not-a-route')
      .set('Origin', deployedOrigin)
      .expect(404);
    expect(response.headers['access-control-allow-origin']).toBe(deployedOrigin);
  });

  test('reports the CORS decision through the debug endpoint', async () => {
    const response = await request(app)
      .get('/api/cors-debug')
      .set('Origin', deployedOrigin)
      .expect(200);

    expect(response.body).toEqual({
      origin: deployedOrigin,
      allowed: true,
      accessControlAllowOrigin: deployedOrigin,
    });
  });
});
