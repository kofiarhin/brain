import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.js';
import { executeGoodMorning } from '../services/commands/index.js';

try {
  await connectDB();
  const result = await executeGoodMorning();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ command: 'good-morning', status: 'failed', errors: [error.message] }, null, 2));
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
