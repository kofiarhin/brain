import request from 'supertest';
import { jest } from '@jest/globals';

function fakeModel(name) {
  let records = [];
  const clone = (item) => ({ ...item });
  return class FakeModel {
    static modelName = name;
    static reset() { records = []; }
    static async create(payload) {
      const item = { _id: `${name}-${records.length + 1}`, status: payload.status || undefined, ...payload, createdAt: new Date(), updatedAt: new Date() };
      records.push(item);
      return clone(item);
    }
    static find() { return { sort: async () => records.map(clone).reverse() }; }
    static async findById(id) { return records.find((item) => item._id === id) || null; }
    static async findByIdAndUpdate(id, payload) {
      const index = records.findIndex((item) => item._id === id);
      if (index === -1) return null;
      records[index] = { ...records[index], ...payload, updatedAt: new Date() };
      return clone(records[index]);
    }
    static async findByIdAndDelete(id) {
      const index = records.findIndex((item) => item._id === id);
      if (index === -1) return null;
      const [removed] = records.splice(index, 1);
      return clone(removed);
    }
    static findOne() { return { sort: async () => records.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null }; }
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
});

describe('latest day plan endpoint', () => {
  test('returns the newest day plan by date', async () => {
    await request(app).post('/api/day-plans').send({ date: '2026-06-22', focus: 'Yesterday' }).expect(201);
    await request(app).post('/api/day-plans').send({ date: '2026-06-23', focus: 'Today' }).expect(201);
    expect((await request(app).get('/api/day-plans/latest').expect(200)).body.focus).toBe('Today');
  });
});

describe('forbidden AI endpoints', () => {
  test('does not expose brain pipeline endpoints', async () => {
    await request(app).post('/api/update-life').send({}).expect(404);
    await request(app).post('/api/plan-day').send({}).expect(404);
    await request(app).post('/api/brain/update-life').send({}).expect(404);
  });
});
