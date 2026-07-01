import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.js';
import { executeReplanDay } from '../services/commands/index.js';

try {
  await connectDB();
  const result = await executeReplanDay();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ command: 'replan-day', status: 'failed', errors: [error.message] }, null, 2));
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
