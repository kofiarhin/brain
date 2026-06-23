import dotenv from 'dotenv';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

dotenv.config();

const port = process.env.PORT || 5000;

async function start() {
  await connectDB();
  const app = createApp();
  app.listen(port, () => console.log(`Brain OS API listening on ${port}`));
}

start().catch((error) => {
  console.error('Failed to start Brain OS API', error);
  process.exit(1);
});
