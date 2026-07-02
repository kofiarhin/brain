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

const outputPath = process.argv[2] || "brain-kb-export.json";

function clean(doc) {
  const item = doc.toObject ? doc.toObject() : { ...doc };
  delete item.__v;
  return item;
}

await connectDB();

const payload = {
  importVersion: "brain-kb.v1",
  exportedAt: new Date().toISOString(),
  data: {
    projects: (await Project.find().sort({ createdAt: 1 })).map(clean),
    notes: (await Note.find().sort({ createdAt: 1 })).map(clean),
    goals: (await Goal.find().sort({ createdAt: 1 })).map(clean),
    ideas: (await Idea.find().sort({ createdAt: 1 })).map(clean),
    context: (await Context.find().sort({ createdAt: 1 })).map(clean),
    preferences: (await Preference.find().sort({ createdAt: 1 })).map(clean),
    reviews: (await Review.find().sort({ date: 1 })).map(clean),
    dayPlans: (await DayPlan.find().sort({ date: 1 })).map(clean),
    reports: (await BrainUpdateReport.find().sort({ runDate: 1 })).map(clean),
    deliverables: (await Deliverable.find().sort({ createdAt: 1 })).map(clean),
    tasks: (await Task.find().sort({ createdAt: 1 })).map(clean),
  },
};

await fs.writeFile(
  path.resolve(outputPath),
  JSON.stringify(payload, null, 2),
  "utf8",
);

console.log(`Exported Brain OS knowledge base to ${outputPath}`);
process.exit(0);
