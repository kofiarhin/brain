import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { DayPlan } from './models/DayPlan.js';
import { initializeRateLimitStores } from './services/rateLimit/index.js';
import { initializeEmbeddingQueue } from './services/queue/index.js';
// Registers the embedding job handler with the queue registry as a side effect.
import './services/noteEmbeddings.js';
import { createLogger } from './services/observability/logger.js';

const port = process.env.PORT || 5000;
const log = createLogger('startup');

/** MongoDB error code for reading a namespace that does not exist yet. */
const NAMESPACE_NOT_FOUND = 26;

async function relaxLegacyDayPlanIndexes() {
  // A fresh database has no dayplans collection, so listing its indexes fails
  // with NamespaceNotFound rather than returning an empty list. There is no
  // legacy index to relax in that case; createIndexes below creates both the
  // collection and its current indexes.
  let indexes = [];
  try {
    indexes = await DayPlan.collection.indexes();
  } catch (error) {
    if (error?.code !== NAMESPACE_NOT_FOUND) throw error;
  }

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

  // Neither of these throws: a misconfigured store or broker degrades to the
  // bounded in-process implementation and is reported through /api/ready.
  const rateLimitStores = await initializeRateLimitStores();
  const embeddingQueue = await initializeEmbeddingQueue();
  log.info('startup_dependencies_ready', {
    rateLimitAuth: rateLimitStores.auth.active,
    rateLimitChat: rateLimitStores.chat.active,
    rateLimitDistributed: rateLimitStores.auth.distributed && rateLimitStores.chat.distributed,
    embeddingQueue: embeddingQueue.active,
    embeddingQueueDurable: embeddingQueue.durable,
  });

  const app = createApp();
  app.listen(port, () => log.info('server_listening', { port: Number(port) }));
}

start().catch((error) => {
  console.error('Failed to start Brain OS API', error);
  process.exit(1);
});
