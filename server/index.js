import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { DayPlan } from './models/DayPlan.js';

const port = process.env.PORT || 5000;

async function relaxLegacyDayPlanIndexes() {
  const indexes = await DayPlan.collection.indexes();
  const legacyLondonDateIndex = indexes.find((index) => (
    index.unique
    && index.key
    && Object.keys(index.key).length === 1
    && index.key.londonDate === 1
  ));

  if (legacyLondonDateIndex) {
    await DayPlan.collection.dropIndex(legacyLondonDateIndex.name);
  }

  await DayPlan.createIndexes();
}

async function start() {
  await connectDB();
  await relaxLegacyDayPlanIndexes();
  const app = createApp();
  app.listen(port, () => console.log(`Brain OS API listening on ${port}`));
}

start().catch((error) => {
  console.error('Failed to start Brain OS API', error);
  process.exit(1);
});
