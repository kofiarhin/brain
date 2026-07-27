import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.resolve(__dirname, '../scripts/nvidiaSmokeTest.js');

/**
 * The smoke test must never run during ordinary CI. These tests verify only its
 * refusal behaviour — they run the script as a child process with the opt-in
 * flag absent or its safety preconditions unmet, so no provider or database call
 * can occur.
 */
function runScript(env) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      code: error.status ?? 1,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

const baseEnv = {
  RUN_NVIDIA_SMOKE_TEST: '',
  SMOKE_TEST_MONGODB_URI: '',
  SMOKE_TEST_ALLOW_PRODUCTION: '',
  NVIDIA_API_KEY: '',
  MONGODB_URI: '',
  NODE_ENV: 'test',
};

describe('opt-in smoke test guards', () => {
  test('skips safely when the opt-in flag is absent', () => {
    const { code, stdout } = runScript(baseEnv);
    expect(code).toBe(0);
    expect(stdout).toContain('"skipped":true');
  });

  test('skips when the opt-in flag is not exactly "true"', () => {
    const { code, stdout } = runScript({ ...baseEnv, RUN_NVIDIA_SMOKE_TEST: 'yes' });
    expect(code).toBe(0);
    expect(stdout).toContain('"skipped":true');
  });

  test('refuses without a dedicated non-production database URI', () => {
    const { code, stdout, stderr } = runScript({
      ...baseEnv, RUN_NVIDIA_SMOKE_TEST: 'true', NVIDIA_API_KEY: 'test-key',
    });
    expect(code).toBe(1);
    expect(`${stdout}${stderr}`).toContain('SMOKE_TEST_MONGODB_URI');
  });

  test('refuses when the smoke database matches the primary database', () => {
    const uri = 'mongodb://localhost:27017/brain';
    const { code, stdout, stderr } = runScript({
      ...baseEnv,
      RUN_NVIDIA_SMOKE_TEST: 'true',
      NVIDIA_API_KEY: 'test-key',
      MONGODB_URI: uri,
      SMOKE_TEST_MONGODB_URI: uri,
    });
    expect(code).toBe(1);
    expect(`${stdout}${stderr}`).toContain('must differ from MONGODB_URI');
  });

  test('refuses in an obvious production environment', () => {
    const { code, stdout, stderr } = runScript({
      ...baseEnv,
      RUN_NVIDIA_SMOKE_TEST: 'true',
      NODE_ENV: 'production',
      NVIDIA_API_KEY: 'test-key',
      SMOKE_TEST_MONGODB_URI: 'mongodb://localhost:27017/brain_smoke',
    });
    expect(code).toBe(1);
    expect(`${stdout}${stderr}`).toContain('production');
  });

  test('refuses without an NVIDIA key', () => {
    const { code, stdout, stderr } = runScript({
      ...baseEnv,
      RUN_NVIDIA_SMOKE_TEST: 'true',
      SMOKE_TEST_MONGODB_URI: 'mongodb://localhost:27017/brain_smoke',
    });
    expect(code).toBe(1);
    expect(`${stdout}${stderr}`).toContain('NVIDIA_API_KEY');
  });

  test('refusal output never echoes the connection string or key', () => {
    const { stdout, stderr } = runScript({
      ...baseEnv,
      RUN_NVIDIA_SMOKE_TEST: 'true',
      NODE_ENV: 'production',
      NVIDIA_API_KEY: 'nvapi-super-secret',
      MONGODB_URI: 'mongodb+srv://user:pw@cluster.example.net/brain',
      SMOKE_TEST_MONGODB_URI: 'mongodb+srv://user:pw@smoke.example.net/brain_smoke',
    });
    const output = `${stdout}${stderr}`;
    expect(output).not.toContain('nvapi-super-secret');
    expect(output).not.toContain('cluster.example.net');
    expect(output).not.toContain('smoke.example.net');
    expect(output).not.toContain('pw@');
  });
});
