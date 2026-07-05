import request from 'supertest';
import { createApp } from '../app.js';
import packageInfo from '../../package.json' with { type: 'json' };

describe('GET /api/version', () => {
  it('returns app version metadata', async () => {
    const response = await request(createApp({ serveClient: false }))
      .get('/api/version')
      .expect(200);

    expect(response.body).toEqual({
      name: packageInfo.name,
      version: packageInfo.version,
      environment: process.env.NODE_ENV || 'development',
      status: 'ok',
      timestamp: expect.any(String),
    });
    expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date');
  });
});
