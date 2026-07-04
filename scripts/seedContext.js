import "dotenv/config";
import { connectDB, disconnectDB } from "../server/config/db.js";
import { Context } from "../server/models/Context.js";
import { contextEntries } from "./data/contextEntries.js";

async function seedContext() {
  try {
    await connectDB();

    const deleted = await Context.deleteMany({});
    const inserted = await Context.insertMany(contextEntries);

    console.log(`Cleared ${deleted.deletedCount} existing context entries.`);
    console.log(`Inserted ${inserted.length} new context entries.`);
  } catch (error) {
    console.error("Failed to seed context:", error);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

await seedContext();
