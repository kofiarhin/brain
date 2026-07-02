import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { connectDB, disconnectDB } from '../config/db.js';
import { executeRefreshBrain } from '../services/commands/index.js';

export async function runRefreshBrainCommandScript({
  connect = connectDB,
  disconnect = disconnectDB,
  execute = executeRefreshBrain,
  log = console.log,
  errorLog = console.error,
} = {}) {
  try {
    await connect();
    const result = await execute();
    log(JSON.stringify(result, null, 2));
    if (result.status === 'failed') process.exitCode = 1;
    return result;
  } catch (error) {
    const failure = { command: 'refresh-brain', status: 'failed', errors: [error.message] };
    errorLog(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
    return failure;
  } finally {
    await disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await runRefreshBrainCommandScript();
}
