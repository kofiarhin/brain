import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import process from "process";

import { connectDB } from "../server/config/db.js";
import { Note } from "../server/models/Note.js";
import { Task } from "../server/models/Task.js";
import { Deliverable } from "../server/models/Deliverable.js";
import { Goal } from "../server/models/Goal.js";
import { Project } from "../server/models/Project.js";
import { Idea } from "../server/models/Idea.js";
import { Context } from "../server/models/Context.js";
import { Preference } from "../server/models/Preference.js";
import { Review } from "../server/models/Review.js";
import { DayPlan } from "../server/models/DayPlan.js";
import { BrainUpdateReport } from "../server/models/BrainUpdateReport.js";

const inputPath = process.argv[2] || "brain-kb-export.json";

function stripMongoFields(item) {
  const next = { ...item };
  delete next.__v;
  return next;
}

function ensureArray(payload, key) {
  return Array.isArray(payload?.data?.[key]) ? payload.data[key] : [];
}

async function insertCollection(Model, items) {
  if (!items.length) return [];
  return Model.insertMany(items.map(stripMongoFields), { ordered: false });
}

const raw = await fs.readFile(path.resolve(inputPath), "utf8");
const payload = JSON.parse(raw);

if (payload.importVersion !== "brain-kb.v1") {
  throw new Error('Invalid import file: expected importVersion "brain-kb.v1"');
}

await connectDB();

const results = {
  projects: await insertCollection(Project, ensureArray(payload, "projects")),
  notes: await insertCollection(Note, ensureArray(payload, "notes")),
  goals: await insertCollection(Goal, ensureArray(payload, "goals")),
  ideas: await insertCollection(Idea, ensureArray(payload, "ideas")),
  context: await insertCollection(Context, ensureArray(payload, "context")),
  preferences: await insertCollection(
    Preference,
    ensureArray(payload, "preferences"),
  ),
  reviews: await insertCollection(Review, ensureArray(payload, "reviews")),
  dayPlans: await insertCollection(DayPlan, ensureArray(payload, "dayPlans")),
  reports: await insertCollection(
    BrainUpdateReport,
    ensureArray(payload, "reports"),
  ),
  deliverables: await insertCollection(
    Deliverable,
    ensureArray(payload, "deliverables"),
  ),
  tasks: await insertCollection(Task, ensureArray(payload, "tasks")),
};

console.log(`Imported Brain OS knowledge base from ${inputPath}:`);
for (const [collection, docs] of Object.entries(results)) {
  console.log(`- ${collection}: ${docs.length}`);
}

process.exit(0);
