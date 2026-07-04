import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.js';
import { executeInboxBriefing } from '../services/commands/index.js';

await connectDB();
try {
  const result = await executeInboxBriefing();
  console.log(result);
} finally {
  await disconnectDB();
}
