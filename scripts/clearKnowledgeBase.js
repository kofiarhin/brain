import "dotenv/config";
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

await connectDB();

const results = {
  tasks: await Task.deleteMany({}),
  deliverables: await Deliverable.deleteMany({}),
  goals: await Goal.deleteMany({}),
  projects: await Project.deleteMany({}),
  ideas: await Idea.deleteMany({}),
  context: await Context.deleteMany({}),
  preferences: await Preference.deleteMany({}),
  reviews: await Review.deleteMany({}),
  dayPlans: await DayPlan.deleteMany({}),
  reports: await BrainUpdateReport.deleteMany({}),
  notes: await Note.deleteMany({}),
};

console.log("Cleared Brain OS knowledge base:");
for (const [collection, result] of Object.entries(results)) {
  console.log(`- ${collection}: ${result.deletedCount}`);
}

process.exit(0);
