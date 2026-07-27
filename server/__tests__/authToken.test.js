import {
  createToken,
  verifyToken,
  parseDuration,
  validateJwtSecret,
  getTokenTtlSeconds,
  DEFAULT_TOKEN_TTL_SECONDS,
  MIN_JWT_SECRET_LENGTH,
} from '../services/auth.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => { process.env = { ...ORIGINAL_ENV }; });
afterAll(() => { process.env = ORIGINAL_ENV; });

const config = { username: 'admin', password: 'password', jwtSecret: 'a'.repeat(40), tokenTtlSeconds: 3600 };

describe('token lifetime configuration', () => {
  test('parses common duration spellings', () => {
    expect(parseDuration('3600')).toBe(3600);
    expect(parseDuration('60s')).toBe(60);
    expect(parseDuration('15m')).toBe(900);
    expect(parseDuration('1h')).toBe(3600);
    expect(parseDuration('7d')).toBe(604800);
  });

  test('falls back for invalid input rather than producing NaN', () => {
    for (const raw of ['', '   ', 'abc', '-1', '1.5h', 'h', null, undefined, '0']) {
      const result = parseDuration(raw);
      expect(Number.isSafeInteger(result)).toBe(true);
      expect(result).toBe(DEFAULT_TOKEN_TTL_SECONDS);
    }
  });

  test('rejects absurd lifetimes in both directions', () => {
    expect(parseDuration('1s')).toBe(DEFAULT_TOKEN_TTL_SECONDS);
    expect(parseDuration('3650d')).toBe(DEFAULT_TOKEN_TTL_SECONDS);
  });

  test('the default lifetime is far shorter than the previous 30 days', () => {
    expect(DEFAULT_TOKEN_TTL_SECONDS).toBeLessThan(30 * 24 * 60 * 60);
    expect(DEFAULT_TOKEN_TTL_SECONDS).toBeGreaterThanOrEqual(60 * 60);
  });

  test('honours JWT_EXPIRES_IN', () => {
    process.env.JWT_EXPIRES_IN = '1h';
    expect(getTokenTtlSeconds()).toBe(3600);
  });

  test('issued tokens expire according to the configured lifetime', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const issued = createToken('admin', { ...config, tokenTtlSeconds: 3600 }, now);
    expect(issued.expiresAt).toBe('2026-01-01T01:00:00.000Z');
  });
});

describe('JWT secret validation', () => {
  test('is not enforced outside production', () => {
    expect(validateJwtSecret('short', { production: false })).toEqual([]);
  });

  test('rejects a short secret in production', () => {
    const problems = validateJwtSecret('short', { production: true });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain(String(MIN_JWT_SECRET_LENGTH));
  });

  test('rejects well-known placeholder secrets in production', () => {
    expect(validateJwtSecret('changeme', { production: true }).length).toBeGreaterThan(0);
    expect(validateJwtSecret('secret', { production: true }).length).toBeGreaterThan(0);
  });

  test('accepts a strong secret in production', () => {
    expect(validateJwtSecret('x'.repeat(48), { production: true })).toEqual([]);
  });

  test('validation messages never echo the secret value', () => {
    const secret = 'changeme';
    const problems = validateJwtSecret(secret, { production: true });
    expect(problems.join(' ')).not.toContain(secret);
  });
});

describe('token verification', () => {
  test('accepts a freshly issued token', () => {
    const { token } = createToken('admin', config);
    expect(verifyToken(token, config)).toMatchObject({ username: 'admin' });
  });

  test('rejects an expired token', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const { token } = createToken('admin', { ...config, tokenTtlSeconds: 60 }, issuedAt);
    expect(verifyToken(token, config, new Date('2026-01-01T00:02:00.000Z'))).toBeNull();
  });

  test('rejects a tampered signature', () => {
    const { token } = createToken('admin', config);
    const [header, payload] = token.split('.');
    expect(verifyToken(`${header}.${payload}.forged`, config)).toBeNull();
  });

  test('rejects a token signed with a different secret', () => {
    const { token } = createToken('admin', { ...config, jwtSecret: 'b'.repeat(40) });
    expect(verifyToken(token, config)).toBeNull();
  });

  test('rejects an algorithm-confusion attempt', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      username: 'admin', exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    expect(verifyToken(`${header}.${payload}.`, config)).toBeNull();
  });

  test('rejects a malformed token', () => {
    for (const token of ['', 'not-a-token', 'a.b', null, undefined, 123]) {
      expect(verifyToken(token, config)).toBeNull();
    }
  });

  test('the issued payload carries no secret or password', () => {
    const issued = createToken('admin', config);
    const payload = JSON.parse(Buffer.from(issued.token.split('.')[1], 'base64url').toString('utf8'));
    const serialized = JSON.stringify({ issued, payload });
    expect(serialized).not.toContain(config.jwtSecret);
    expect(serialized).not.toContain('password');
  });
});
