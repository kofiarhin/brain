import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.js';
import { executeUpdateBrain } from '../services/commands/index.js';

try {
  await connectDB();
  const result = await executeUpdateBrain();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'failed') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ command: 'update-brain', status: 'failed', errors: [error.message] }, null, 2));
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
