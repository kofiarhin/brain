import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { connectDB, disconnectDB } from '../config/db.js';
import { executeReplanDay } from '../services/commands/index.js';

export async function runReplanDayCommandScript({
  connect = connectDB,
  disconnect = disconnectDB,
  execute = executeReplanDay,
  log = console.log,
  errorLog = console.error,
} = {}) {
  try {
    await connect();
    const result = await execute();
    log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    const failure = { command: 'replan-day', status: 'failed', errors: [error.message] };
    errorLog(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
    return failure;
  } finally {
    await disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await runReplanDayCommandScript();
}
