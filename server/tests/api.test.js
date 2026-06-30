import supertest from 'supertest';
import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { categorizeTaskTitle } from '../services/taskCategorization.js';
import { getLondonDateKey } from '../services/londonDate.js';

process.env.AUTH_USERNAME = 'admin';
process.env.AUTH_PASSWORD = 'password';
process.env.JWT_SECRET = 'test-secret';

let authHeader;
function request(app) {
  const testRequest = supertest(app);
  if (!authHeader) return testRequest;
  return {
    get: (path) => testRequest.get(path).set('Authorization', authHeader),
    post: (path) => testRequest.post(path).set('Authorization', authHeader),
    patch: (path) => testRequest.patch(path).set('Authorization', authHeader),
    put: (path) => testRequest.put(path).set('Authorization', authHeader),
    delete: (path) => testRequest.delete(path).set('Authorization', authHeader),
    options: (path) => testRequest.options(path).set('Authorization', authHeader),
  };
}

function publicRequest(app) {
  return supertest(app);
}

function fakeModel(name) {
  let records = [];
  const clone = (item) => (item ? { ...item } : item);
  const valueAtPath = (item, path) => path.split('.').reduce((current, key) => current?.[key], item);
  const matchesQuery = (item, query = {}) => Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some((branch) => matchesQuery(item, branch));
    const actual = valueAtPath(item, key);
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$nin' in expected) return !expected.$nin.includes(actual);
      if ('$in' in expected) return expected.$in.includes(actual);
      if ('$gte' in expected && new Date(actual) < new Date(expected.$gte)) return false;
      if ('$lt' in expected && new Date(actual) >= new Date(expected.$lt)) return false;
      if ('$lte' in expected && new Date(actual) > new Date(expected.$lte)) return false;
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
  const londonDateFrom = (value) => {
    const date = new Date(value);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const queryChain = (items) => {
    let result = items.map(clone);
    const chain = {
      sort(sort) {
        result = sortRecords(result, sort);
        return chain;
      },
      skip(count) {
        result = result.slice(count);
        return chain;
      },
      limit(count) {
        result = result.slice(0, count);
        return chain;
      },
      then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return chain;
  };
  return class FakeModel {
    static modelName = name;
    static reset() { records = []; }
    static normalize(payload) {
      if (name === 'project') {
        const next = {
          status: 'active',
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
      if (name === 'brainUpdateReport') {
        const next = {
          recordsCreated: [],
          recordsUpdated: [],
          skippedItems: [],
          linkedTasks: [],
          linkedProjects: [],
          warnings: [],
          errors: [],
          nextRecommendedActions: [],
          metadata: {},
          ...payload,
        };
        if (!['success', 'partial', 'failed'].includes(next.status)) {
          const error = new Error(`BrainUpdateReport validation failed: status: \`${next.status}\` is not a valid enum value`);
          error.name = 'ValidationError';
          throw error;
        }
        if (!next.runDate) next.runDate = new Date();
        return next;
      }
      if (name === 'preference') {
        return {
          title: 'Default Preferences',
          active: true,
          scheduling: {
            planningWindowStart: '04:00',
            planningWindowEnd: '21:00',
            deepWorkPreferredTime: 'morning',
            gymPreferredTime: 'afternoon',
            meetingAvoidBefore: '10:00',
            bufferTimeRequired: true,
            ...(payload.scheduling || {}),
          },
          planning: {
            maxDailyTasks: 5,
            minimizeContextSwitching: true,
            preferHighImpactExecution: true,
            carryOverFirst: true,
            ...(payload.planning || {}),
          },
          personalConstraints: {
            workFromHome: true,
            familyResponsibilities: true,
            schoolRuns: true,
            helpingLauraWithAto: true,
            ...(payload.personalConstraints || {}),
          },
          output: {
            concise: true,
            includeMotivationalPost: true,
            includeDavidGogginsQuote: true,
            includeStoicQuote: true,
            includeInsightOfTheDay: true,
            ...(payload.output || {}),
          },
          agentBehaviour: {
            verbosity: 'concise',
            autonomy: 'medium',
            ...(payload.agentBehaviour || {}),
          },
          notes: '',
          ...payload,
          active: true,
        };
      }
      if (name === 'dayPlan') {
        return {
          ...payload,
          londonDate: payload.londonDate || (payload.date ? londonDateFrom(payload.date) : undefined),
        };
      }
      if (name !== 'task') return payload;
      const next = {
        category: 'general',
        agentReady: false,
        status: 'open',
        outcome: payload.outcome || payload.status || 'open',
        reviewRequired: false,
        reviewStatus: 'pending',
        outcomeHistory: [],
        scheduleHistory: [],
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
      const createPayload = name === 'task' ? { ...payload, category: categorizeTaskTitle(payload.title) } : payload;
      const normalizedPayload = this.normalize(createPayload);
      const item = { _id: `${name}-${records.length + 1}`, status: normalizedPayload.status || undefined, ...normalizedPayload, createdAt: new Date(), updatedAt: new Date() };
      records.push(item);
      return clone(item);
    }
    static find(query = {}) { return queryChain(records.filter((item) => matchesQuery(item, query))); }
    static async countDocuments(query = {}) { return records.filter((item) => matchesQuery(item, query)).length; }
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
const Preference = fakeModel('preference');
const Review = fakeModel('review');
const DayPlan = fakeModel('dayPlan');
const BrainUpdateReport = fakeModel('brainUpdateReport');

jest.unstable_mockModule('../models/Note.js', () => ({ Note }));
jest.unstable_mockModule('../models/Task.js', () => ({
  Task,
  dismissalReasons: [
    'task_no_longer_needed',
    'project_abandoned',
    'duplicate',
    'generated_incorrectly',
    'circumstances_changed',
    'external_blocker',
    'replaced_by_another_task',
    'other',
  ],
}));
jest.unstable_mockModule('../models/Deliverable.js', () => ({ Deliverable }));
jest.unstable_mockModule('../models/Goal.js', () => ({ Goal }));
jest.unstable_mockModule('../models/Project.js', () => ({ Project }));
jest.unstable_mockModule('../models/Idea.js', () => ({ Idea }));
jest.unstable_mockModule('../models/Context.js', () => ({ Context }));
jest.unstable_mockModule('../models/Preference.js', () => ({ Preference }));
jest.unstable_mockModule('../models/Review.js', () => ({ Review }));
jest.unstable_mockModule('../models/DayPlan.js', () => ({ DayPlan }));
jest.unstable_mockModule('../models/BrainUpdateReport.js', () => ({ BrainUpdateReport }));

const { createApp } = await import('../app.js');
const { createToken } = await import('../services/auth.js');
const app = createApp();
authHeader = `Bearer ${createToken('admin').token}`;

beforeEach(() => [Note, Task, Deliverable, Goal, Project, Idea, Context, Preference, Review, DayPlan, BrainUpdateReport].forEach((model) => model.reset()));


describe('authentication', () => {
  test('login succeeds with correct env credentials', async () => {
    const response = await publicRequest(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' })
      .expect(200);

    expect(response.body.username).toBe('admin');
    expect(response.body.token).toBeTruthy();
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test('login fails with wrong credentials', async () => {
    await publicRequest(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);
  });

  test('protected route rejects missing token', async () => {
    await publicRequest(app).get('/api/notes').expect(401);
  });

  test('public health route stays public', async () => {
    await publicRequest(app).get('/api/health').expect(200);
  });

  test('missing auth env returns a clear server error', async () => {
    const previousPassword = process.env.AUTH_PASSWORD;
    delete process.env.AUTH_PASSWORD;
    expect(() => createApp()).toThrow('Missing required auth environment variables: AUTH_PASSWORD');
    process.env.AUTH_PASSWORD = previousPassword;
  });
});

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

describe('preferences API', () => {
  test('active preferences endpoint creates and returns defaults', async () => {
    const response = await request(app).get('/api/preferences/active').expect(200);

    expect(response.body.active).toBe(true);
    expect(response.body.title).toBe('Default Preferences');
    expect(response.body.scheduling.planningWindowStart).toBe('04:00');
    expect(response.body.planning.maxDailyTasks).toBe(5);
    expect(response.body.agentBehaviour.verbosity).toBe('concise');
  });

  test('active preferences endpoint updates values and keeps active true', async () => {
    await request(app).get('/api/preferences/active').expect(200);

    const response = await request(app)
      .patch('/api/preferences/active')
      .send({
        active: false,
        scheduling: { planningWindowStart: '06:00', planningWindowEnd: '18:00' },
        planning: { maxDailyTasks: 3 },
        agentBehaviour: { verbosity: 'balanced', autonomy: 'high' },
      })
      .expect(200);

    expect(response.body.active).toBe(true);
    expect(response.body.scheduling.planningWindowStart).toBe('06:00');
    expect(response.body.scheduling.planningWindowEnd).toBe('18:00');
    expect(response.body.planning.maxDailyTasks).toBe(3);
    expect(response.body.agentBehaviour).toEqual(expect.objectContaining({ verbosity: 'balanced', autonomy: 'high' }));
  });
});

describe('task completion', () => {
  test('completes and reopens a task', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Ship Brain OS' }).expect(201);
    const completed = await request(app).patch(`/api/tasks/${created.body._id}/complete`).expect(200);
    expect(completed.body._id).toBe(created.body._id);
    expect(completed.body.status).toBe('complete');
    expect(completed.body.outcome).toBe('complete');
    expect(completed.body.completedAt).toBeTruthy();
    expect(completed.body.outcomeHistory).toHaveLength(1);
    const reopened = await request(app).patch(`/api/tasks/${created.body._id}/reopen`).expect(200);
    expect(reopened.body._id).toBe(created.body._id);
    expect(reopened.body.status).toBe('open');
    expect(reopened.body.completedAt).toBeNull();
  });

  test('dismisses a task with reason and note while preserving id', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Wrong generated task' }).expect(201);

    const dismissed = await request(app)
      .patch(`/api/tasks/${created.body._id}/dismiss`)
      .send({ reason: 'generated_incorrectly', note: 'Wrong assumption' })
      .expect(200);

    expect(dismissed.body._id).toBe(created.body._id);
    expect(dismissed.body.status).toBe('dismissed');
    expect(dismissed.body.outcome).toBe('dismissed');
    expect(dismissed.body.dismissedAt).toBeTruthy();
    expect(dismissed.body.dismissedReason).toBe('generated_incorrectly');
    expect(dismissed.body.dismissedNote).toBe('Wrong assumption');
    expect(dismissed.body.outcomeHistory.at(-1).reason).toBe('generated_incorrectly');

    const response = await request(app).post('/api/day-plans/start').send({ now: '2026-06-26T08:00:00.000Z' }).expect(201);
    expect(response.body.carriedForwardItems).not.toContain('Wrong generated task');
  });

  test('archives a task and removes it from active planning', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Old task' }).expect(201);
    const archived = await request(app).patch(`/api/tasks/${created.body._id}/archive`).expect(200);

    expect(archived.body._id).toBe(created.body._id);
    expect(archived.body.status).toBe('archived');
    expect(archived.body.archivedAt).toBeTruthy();

    const response = await request(app).post('/api/day-plans/start').send({ now: '2026-06-26T08:00:00.000Z' }).expect(201);
    expect(response.body.carriedForwardItems).not.toContain('Old task');
  });

  test('converts a task to replacement work and removes original from active planning', async () => {
    const original = await request(app).post('/api/tasks').send({ title: 'Original task' }).expect(201);
    const replacement = await request(app).post('/api/tasks').send({ title: 'Replacement task' }).expect(201);

    const converted = await request(app)
      .patch(`/api/tasks/${original.body._id}/convert`)
      .send({ replacementTaskId: replacement.body._id })
      .expect(200);

    expect(converted.body._id).toBe(original.body._id);
    expect(converted.body.status).toBe('converted');
    expect(converted.body.replacementTaskId).toBe(replacement.body._id);

    const response = await request(app).post('/api/day-plans/start').send({ now: '2026-06-26T08:00:00.000Z' }).expect(201);
    expect(response.body.carriedForwardItems).toContain('Replacement task');
    expect(response.body.carriedForwardItems).not.toContain('Original task');
  });

  test('project_abandoned dismissal can keep project active or mark it inactive', async () => {
    const projectOnly = await request(app).post('/api/projects').send({ name: 'Keep active project' }).expect(201);
    const taskOnly = await request(app).post('/api/tasks').send({ title: 'Drop task only', projectId: projectOnly.body._id }).expect(201);

    await request(app)
      .patch(`/api/tasks/${taskOnly.body._id}/dismiss`)
      .send({ reason: 'project_abandoned', markProjectInactive: false })
      .expect(200);

    expect((await request(app).get(`/api/projects/${projectOnly.body._id}`).expect(200)).body.status).toBe('active');

    const inactiveProject = await request(app).post('/api/projects').send({ name: 'Inactive project' }).expect(201);
    const inactiveTask = await request(app).post('/api/tasks').send({ title: 'Drop project task', projectId: inactiveProject.body._id }).expect(201);

    await request(app)
      .patch(`/api/tasks/${inactiveTask.body._id}/dismiss`)
      .send({ reason: 'project_abandoned', markProjectInactive: true })
      .expect(200);

    const project = await request(app).get(`/api/projects/${inactiveProject.body._id}`).expect(200);
    expect(project.body.status).toBe('inactive');
    expect(project.body.focusToday).toBe(false);
  });

  test('categorizes task titles and defaults agent readiness', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Default task' }).expect(201);
    expect(created.body.category).toBe('general');
    expect(created.body.agentReady).toBe(false);

    const projectTask = await request(app).post('/api/tasks').send({ title: 'fix API bug' }).expect(201);
    expect(projectTask.body.category).toBe('projects');

    const priorityTask = await request(app).post('/api/tasks').send({ title: 'call doctor' }).expect(201);
    expect(priorityTask.body.category).toBe('personal');
  });

  test('ignores supplied task category on create and updates category and agent readiness', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Codex task', category: 'projects', agentReady: true })
      .expect(201);

    expect(created.body.category).toBe('general');
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

  test('does not reject invalid task categories on create', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Bad category', category: 'invalid' })
      .expect(201);

    expect(created.body.category).toBe('general');
  });

  test('postponing keeps the same task id and updates schedule history', async () => {
    const todayKey = getLondonDateKey(new Date());
    const [year, month, day] = todayKey.split('-').map(Number);
    const targetDate = getLondonDateKey(new Date(Date.UTC(year, month - 1, day + 1, 12)));
    const created = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Carry this task',
        notes: 'Keep these notes',
        expectedDeliverable: 'Keep deliverable',
        projectId: 'project-1',
        codexPrompt: 'Keep prompt',
      })
      .expect(201);

    const postponed = await request(app)
      .patch(`/api/tasks/${created.body._id}/reschedule`)
      .send({ targetDate, reason: 'tomorrow' })
      .expect(200);

    expect(postponed.body._id).toBe(created.body._id);
    expect(postponed.body.title).toBe('Carry this task');
    expect(postponed.body.notes).toBe('Keep these notes');
    expect(postponed.body.expectedDeliverable).toBe('Keep deliverable');
    expect(postponed.body.projectId).toBe('project-1');
    expect(postponed.body.codexPrompt).toBe('Keep prompt');
    expect(postponed.body.status).toBe('rescheduled');
    expect(postponed.body.outcome).toBe('rescheduled');
    expect(postponed.body.scheduledLondonDate).toBe(targetDate);
    expect(postponed.body.postponedCount).toBe(1);
    expect(postponed.body.postponedReason).toBe('tomorrow');
    expect(postponed.body.scheduleHistory).toHaveLength(1);
    expect(postponed.body.scheduleHistory[0].toScheduledLondonDate).toBe(targetDate);
    expect(postponed.body.outcomeHistory.at(-1).toStatus).toBe('rescheduled');

    const listed = await request(app).get('/api/tasks').expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]._id).toBe(created.body._id);
  });

  test('rejects invalid task reschedule target dates', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Invalid move' }).expect(201);

    await request(app)
      .patch(`/api/tasks/${created.body._id}/reschedule`)
      .send({ targetDate: 'not-a-date' })
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

  test('deletes one project without affecting others', async () => {
    const target = await request(app)
      .post('/api/projects')
      .send({ name: 'Peekofo Telegram Integration' })
      .expect(201);
    const other = await request(app)
      .post('/api/projects')
      .send({ name: 'Brain OS' })
      .expect(201);

    await request(app).delete(`/api/projects/${target.body._id}`).expect(204);
    await request(app).get(`/api/projects/${target.body._id}`).expect(404);

    const remaining = await request(app).get('/api/projects').expect(200);
    expect(remaining.body).toHaveLength(1);
    expect(remaining.body[0]._id).toBe(other.body._id);
    expect(remaining.body[0].name).toBe('Brain OS');
  });
});

describe('latest day plan endpoint', () => {
  function londonKeyDaysAgo(days) {
    const todayKey = getLondonDateKey(new Date());
    const [year, month, day] = todayKey.split('-').map(Number);
    return getLondonDateKey(new Date(Date.UTC(year, month - 1, day - days, 12)));
  }

  function planPayload(londonDate, focus, extra = {}) {
    return {
      date: `${londonDate}T08:00:00.000Z`,
      londonDate,
      startTime: `${londonDate}T08:00:00.000Z`,
      focus,
      ...extra,
    };
  }

  test("returns today's plan only", async () => {
    const today = londonKeyDaysAgo(0);
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(1), 'Yesterday')).expect(201);
    await request(app).post('/api/day-plans').send(planPayload(today, 'Today')).expect(201);

    expect((await request(app).get('/api/day-plans/latest').expect(200)).body.focus).toBe('Today');
  });

  test("returns 404 when only yesterday's plan exists", async () => {
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(1), 'Yesterday')).expect(201);

    const response = await request(app).get('/api/day-plans/latest').expect(404);
    expect(response.body.message).toBe('No day plan found for today');
  });

  test("sorts today's plans by startTime desc then createdAt desc", async () => {
    const today = londonKeyDaysAgo(0);
    await request(app).post('/api/day-plans').send(planPayload(today, 'Morning', { startTime: `${today}T08:00:00.000Z` })).expect(201);
    await request(app).post('/api/day-plans').send(planPayload(today, 'Afternoon', { startTime: `${today}T12:00:00.000Z` })).expect(201);

    expect((await request(app).get('/api/day-plans/latest').expect(200)).body.focus).toBe('Afternoon');
  });

  test('legacy day plans without session fields still work', async () => {
    const today = londonKeyDaysAgo(0);
    await request(app).post('/api/day-plans').send({ date: `${today}T08:00:00.000Z`, londonDate: today, focus: 'Legacy' }).expect(201);
    const latest = await request(app).get('/api/day-plans/latest').expect(200);

    expect(latest.body.focus).toBe('Legacy');
    expect(latest.body.status).toBeUndefined();
  });

  test('previous excludes today', async () => {
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(0), 'Today')).expect(201);
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(1), 'Yesterday')).expect(201);

    const response = await request(app).get('/api/day-plans/previous').expect(200);
    expect(response.body.items.map((plan) => plan.focus)).toEqual(['Yesterday']);
    expect(response.body.total).toBe(1);
  });

  test('previous sorts newest first', async () => {
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(3), 'Three days ago')).expect(201);
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(1), 'Yesterday morning', { startTime: `${londonKeyDaysAgo(1)}T08:00:00.000Z` })).expect(201);
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(1), 'Yesterday afternoon', { startTime: `${londonKeyDaysAgo(1)}T14:00:00.000Z` })).expect(201);
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(2), 'Two days ago')).expect(201);

    const response = await request(app).get('/api/day-plans/previous?limit=10').expect(200);
    expect(response.body.items.map((plan) => plan.focus)).toEqual([
      'Yesterday afternoon',
      'Yesterday morning',
      'Two days ago',
      'Three days ago',
    ]);
  });

  test('previous paginates correctly', async () => {
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(1), 'Yesterday')).expect(201);
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(2), 'Two days ago')).expect(201);
    await request(app).post('/api/day-plans').send(planPayload(londonKeyDaysAgo(3), 'Three days ago')).expect(201);

    const pageOne = await request(app).get('/api/day-plans/previous').expect(200);
    expect(pageOne.body.items.map((plan) => plan.focus)).toEqual(['Yesterday']);
    expect(pageOne.body).toEqual(expect.objectContaining({
      page: 1,
      limit: 1,
      total: 3,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    }));

    const pageTwo = await request(app).get('/api/day-plans/previous?page=2&limit=1').expect(200);
    expect(pageTwo.body.items.map((plan) => plan.focus)).toEqual(['Two days ago']);
    expect(pageTwo.body).toEqual(expect.objectContaining({
      page: 2,
      limit: 1,
      total: 3,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    }));
  });

  test('by-date returns null plan for a missing London date', async () => {
    const response = await request(app).get('/api/day-plans/by-date/2026-06-30').expect(200);
    expect(response.body).toEqual({ date: '2026-06-30', plan: null });
  });

  test('by-date returns the matching plan for the London date', async () => {
    await request(app).post('/api/day-plans').send(planPayload('2026-06-27', 'Matching plan')).expect(201);
    await request(app).post('/api/day-plans').send(planPayload('2026-06-28', 'Other plan')).expect(201);

    const response = await request(app).get('/api/day-plans/by-date/2026-06-27').expect(200);
    expect(response.body.date).toBe('2026-06-27');
    expect(response.body.plan.focus).toBe('Matching plan');
  });

  test('by-date rejects invalid date formats', async () => {
    const response = await request(app).get('/api/day-plans/by-date/not-a-date').expect(400);
    expect(response.body).toEqual({ message: 'Invalid date format. Use YYYY-MM-DD.' });
  });

  test('by-date route is not swallowed by the id route', async () => {
    const response = await request(app).get('/api/day-plans/by-date/2026-06-30').expect(200);
    expect(response.body).toHaveProperty('date', '2026-06-30');
    expect(response.body).toHaveProperty('plan', null);
  });
});

describe('brain update reports API', () => {
  test('creates and lists reports', async () => {
    const created = await request(app)
      .post('/api/brain-update-reports')
      .send({
        status: 'success',
        summary: 'Processed notes into brain collections',
        recordsCreated: [{ model: 'Task', title: 'Follow up' }],
        recordsUpdated: [{ model: 'Project', name: 'Brain OS' }],
        skippedItems: ['Ambiguous note'],
        errors: [],
      })
      .expect(201);

    expect(created.body.status).toBe('success');
    expect(created.body.recordsCreated).toHaveLength(1);

    const listed = await request(app).get('/api/brain-update-reports').expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].summary).toBe('Processed notes into brain collections');
  });

  test('filters reports by status', async () => {
    await request(app).post('/api/brain-update-reports').send({ status: 'success', summary: 'Good run' }).expect(201);
    await request(app).post('/api/brain-update-reports').send({ status: 'partial', summary: 'Mixed run' }).expect(201);

    const response = await request(app).get('/api/brain-update-reports?status=partial').expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].summary).toBe('Mixed run');
  });

  test('filters reports by runDate range', async () => {
    await request(app).post('/api/brain-update-reports').send({ status: 'success', runDate: '2026-06-20T09:00:00.000Z', summary: 'Old run' }).expect(201);
    await request(app).post('/api/brain-update-reports').send({ status: 'success', runDate: '2026-06-25T09:00:00.000Z', summary: 'Current run' }).expect(201);
    await request(app).post('/api/brain-update-reports').send({ status: 'success', runDate: '2026-06-27T09:00:00.000Z', summary: 'Future run' }).expect(201);

    const response = await request(app).get('/api/brain-update-reports?from=2026-06-24&to=2026-06-26').expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].summary).toBe('Current run');
  });

  test('retrieves a report by id', async () => {
    const created = await request(app).post('/api/brain-update-reports').send({ status: 'failed', summary: 'Failed run', errors: ['Mongo timeout'] }).expect(201);
    const response = await request(app).get(`/api/brain-update-reports/${created.body._id}`).expect(200);
    expect(response.body.errors).toEqual(['Mongo timeout']);
  });

  test('invalid status fails validation', async () => {
    await request(app)
      .post('/api/brain-update-reports')
      .send({ status: 'done', summary: 'Invalid' })
      .expect(400);
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

  test('start day creates default preferences when none exist', async () => {
    const response = await request(app).post('/api/day-plans/start').send({ now: '2026-06-26T08:00:00.000Z' }).expect(201);

    expect(response.body.focus).toContain('04:00-21:00');
    expect(response.body.forgotten).toContain('Daily task capacity preference: 5.');
    expect((await request(app).get('/api/preferences').expect(200)).body).toHaveLength(1);
  });

  test('start day uses existing active preferences', async () => {
    await request(app)
      .patch('/api/preferences/active')
      .send({
        scheduling: { planningWindowStart: '06:00', planningWindowEnd: '18:00' },
        planning: { maxDailyTasks: 1 },
      })
      .expect(200);
    await request(app).post('/api/tasks').send({ title: 'First task', priority: 'must', status: 'open' }).expect(201);
    await request(app).post('/api/tasks').send({ title: 'Second task', priority: 'should', status: 'open' }).expect(201);

    const response = await request(app).post('/api/day-plans/start').send({ now: '2026-06-26T08:00:00.000Z' }).expect(201);

    expect(response.body.focus).toContain('06:00-18:00');
    expect(response.body.forgotten).toContain('Daily task capacity preference: 1.');
    expect(response.body.unclearItems[0]).toContain('preference of 1 daily tasks');
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

  test('start day carries scheduled and overdue work before unscheduled tasks', async () => {
    await request(app).post('/api/tasks').send({
      title: 'Unscheduled task',
      priority: 'must',
      status: 'open',
    }).expect(201);
    await request(app).post('/api/tasks').send({
      title: 'Overdue scheduled task',
      priority: 'should',
      status: 'open',
      scheduledLondonDate: '2026-06-25',
    }).expect(201);
    await request(app).post('/api/tasks').send({
      title: 'Today postponed task',
      priority: 'nice',
      status: 'open',
      scheduledLondonDate: '2026-06-26',
      postponedCount: 1,
    }).expect(201);
    await request(app).post('/api/tasks').send({
      title: 'Future task',
      priority: 'must',
      status: 'open',
      scheduledLondonDate: '2026-06-27',
    }).expect(201);

    const response = await request(app)
      .post('/api/day-plans/start')
      .send({ now: '2026-06-26T08:00:00.000Z' })
      .expect(201);

    expect(response.body.carriedForwardItems.slice(0, 3)).toEqual([
      'Overdue scheduled task',
      'Today postponed task',
      'Unscheduled task',
    ]);
    expect(response.body.carriedForwardItems).not.toContain('Future task');
    expect(response.body.priorities[0]).toBe('Overdue scheduled task');
  });

  test('start day avoids tasks attached to inactive projects', async () => {
    const project = await request(app).post('/api/projects').send({ name: 'Paused project', status: 'inactive' }).expect(201);
    await request(app).post('/api/tasks').send({
      title: 'Inactive project task',
      priority: 'must',
      status: 'open',
      projectId: project.body._id,
    }).expect(201);
    await request(app).post('/api/tasks').send({
      title: 'Active independent task',
      priority: 'must',
      status: 'open',
    }).expect(201);

    const response = await request(app)
      .post('/api/day-plans/start')
      .send({ now: '2026-06-26T08:00:00.000Z' })
      .expect(201);

    expect(response.body.carriedForwardItems).toContain('Active independent task');
    expect(response.body.carriedForwardItems).not.toContain('Inactive project task');
  });
});

describe('forbidden AI endpoints', () => {
  test('does not expose brain pipeline endpoints', async () => {
    await request(app).post('/api/update-life').send({}).expect(404);
    await request(app).post('/api/plan-day').send({}).expect(404);
    await request(app).post('/api/brain/update-life').send({}).expect(404);
  });
});

describe('production frontend serving', () => {
  let tempDir;

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  });

  test('serves the React app for non-API routes and leaves API routes untouched', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-client-dist-'));
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<!doctype html><div id="root">Brain OS</div>');

    const staticApp = createApp({ serveClient: true, clientDistPath: tempDir });

    const loginResponse = await publicRequest(staticApp).get('/login').expect(200);
    expect(loginResponse.text).toContain('Brain OS');
    expect(loginResponse.headers['content-type']).toContain('text/html');

    const healthResponse = await publicRequest(staticApp).get('/api/health').expect(200);
    expect(healthResponse.body).toEqual({ status: 'ok' });

    const apiNotFoundResponse = await publicRequest(staticApp).get('/api/not-a-route').expect(404);
    expect(apiNotFoundResponse.body.message).toBe('Route not found: GET /api/not-a-route');
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
