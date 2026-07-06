import supertest from 'supertest';
import { jest } from '@jest/globals';

process.env.AUTH_USERNAME = 'admin';
process.env.AUTH_PASSWORD = 'password';
process.env.JWT_SECRET = 'test-secret';
process.env.HUGGINGFACE_API_KEY = 'test-key';
process.env.HUGGINGFACE_MODEL = 'test-model';

function fakeModel(name) {
  let records = [];
  const clone = (x) => (x ? { ...x } : x);
  const valueAt = (item, path) => path.split('.').reduce((v, k) => v?.[k], item);
  const match = (item, query = {}) => Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some((q) => match(item, q));
    const actual = valueAt(item, key);
    if (expected instanceof RegExp) return expected.test(actual || '');
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('$in' in expected) return expected.$in.includes(actual);
      if ('$nin' in expected) return !expected.$nin.includes(actual);
      return true;
    }
    return String(actual) === String(expected);
  });
  const chain = (items) => ({
    sort() { return this; }, limit(n) { items = items.slice(0, n); return this; },
    then(resolve, reject) { return Promise.resolve(items.map(clone)).then(resolve, reject); },
  });
  return class FakeModel {
    static reset() { records = []; }
    static all() { return records; }
    static async create(payload) { const item = { _id: `${name}-${records.length + 1}`, ...payload, createdAt: new Date(), updatedAt: new Date() }; records.push(item); return clone(item); }
    static find(query = {}) { return chain(records.filter((item) => match(item, query))); }
    static findOne(query = {}) { return { sort: async () => clone(records.find((item) => match(item, query)) || null) }; }
    static async findById(id) { return clone(records.find((item) => String(item._id) === String(id)) || null); }
    static async findByIdAndUpdate(id, payload) { const index = records.findIndex((item) => String(item._id) === String(id)); if (index < 0) return null; records[index] = { ...records[index], ...payload, updatedAt: new Date() }; return clone(records[index]); }
  };
}

const ChatConversation = fakeModel('conversation');
const ChatMessage = fakeModel('message');
const Context = fakeModel('context');
const Preference = fakeModel('preference');
const Goal = fakeModel('goal');
const Project = fakeModel('project');
const Task = fakeModel('task');
const DayPlan = fakeModel('dayPlan');
const Note = fakeModel('note');
const Idea = fakeModel('idea');
const Review = fakeModel('review');
const Deliverable = fakeModel('deliverable');
const GeneratedPost = fakeModel('generatedPost');
const BrainUpdateReport = fakeModel('brainUpdateReport');

const generateChatCompletion = jest.fn(async () => 'Mock assistant response');
class HuggingFaceProviderError extends Error {}

jest.unstable_mockModule('../models/ChatConversation.js', () => ({ ChatConversation }));
jest.unstable_mockModule('../models/ChatMessage.js', () => ({ ChatMessage }));
jest.unstable_mockModule('../models/Context.js', () => ({ Context }));
jest.unstable_mockModule('../models/Preference.js', () => ({ Preference }));
jest.unstable_mockModule('../models/Goal.js', () => ({ Goal }));
jest.unstable_mockModule('../models/Project.js', () => ({ Project }));
jest.unstable_mockModule('../models/Task.js', () => ({ Task, dismissalReasons: [] }));
jest.unstable_mockModule('../models/DayPlan.js', () => ({ DayPlan }));
jest.unstable_mockModule('../models/Note.js', () => ({ Note }));
jest.unstable_mockModule('../models/Idea.js', () => ({ Idea }));
jest.unstable_mockModule('../models/Review.js', () => ({ Review }));
jest.unstable_mockModule('../models/Deliverable.js', () => ({ Deliverable }));
jest.unstable_mockModule('../models/GeneratedPost.js', () => ({ GeneratedPost }));
jest.unstable_mockModule('../models/BrainUpdateReport.js', () => ({ BrainUpdateReport }));
jest.unstable_mockModule('../services/huggingFaceClient.js', () => ({ generateChatCompletion, HuggingFaceProviderError }));

const { createApp } = await import('../app.js');
const { createToken } = await import('../services/auth.js');
const app = createApp();
const authHeader = `Bearer ${createToken('admin').token}`;

beforeEach(() => {
  [ChatConversation, ChatMessage, Context, Preference, Goal, Project, Task, DayPlan, Note, Idea, Review, Deliverable, GeneratedPost, BrainUpdateReport].forEach((m) => m.reset());
  generateChatCompletion.mockResolvedValue('Mock assistant response');
});

const authed = () => supertest(app).post('/api/chat').set('Authorization', authHeader);

test('POST /api/chat rejects unauthenticated request', async () => {
  await supertest(app).post('/api/chat').send({ message: 'hello' }).expect(401);
});

test('POST /api/chat rejects empty message', async () => {
  await authed().send({ message: '   ' }).expect(400, { message: 'Message is required' });
});

test('POST /api/chat creates conversation and saves user/assistant messages with contextUsed', async () => {
  await Context.create({ category: 'work', value: 'Brain App matters' });
  const response = await authed().send({ message: 'What should I focus on?' }).expect(200);
  expect(response.body.conversationId).toBe('conversation-1');
  expect(response.body.message.content).toBe('Mock assistant response');
  expect(response.body.contextUsed.context).toBe(1);
  expect(ChatConversation.all()).toHaveLength(1);
  expect(ChatMessage.all()).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: 'user', content: 'What should I focus on?' }),
    expect.objectContaining({ role: 'assistant', content: 'Mock assistant response' }),
  ]));
});

test('POST /api/chat falls back to local context when Hugging Face fails', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  generateChatCompletion.mockRejectedValueOnce(new HuggingFaceProviderError('fail'));
  await Task.create({ title: 'Ship chat fallback', priority: 'high', status: 'open' });
  const response = await authed().send({ message: 'hello' }).expect(200);
  expect(response.body.message.content).toContain('hosted AI provider is unavailable');
  expect(response.body.message.content).toContain('Ship chat fallback');
  expect(ChatMessage.all()).toEqual(expect.arrayContaining([
    expect.objectContaining({ role: 'assistant', provider: 'local-fallback', model: 'local-context-summary' }),
  ]));
  expect(warn).toHaveBeenCalledWith('Brain chat provider unavailable: fail');
  warn.mockRestore();
});

test('POST /api/chat returns 404 for invalid conversationId', async () => {
  await authed().send({ message: 'hello', conversationId: 'missing' }).expect(404, { message: 'Conversation not found' });
});
