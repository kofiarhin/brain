# Agent Module: Brain OS Architecture

## Brain OS v2 Architecture

- Frontend = CRUD only. It saves data to MongoDB, retrieves data from MongoDB, and displays generated data.
- MongoDB = source of truth for notes, tasks, day plans, reviews, goals, projects, ideas, context, and preferences.
- Codex CLI = AI layer. Manual commands such as `update life`, `update brain`, `good morning`, `plan my day`, and `morning briefing` read from MongoDB, run the AI workflow, and write back to MongoDB.
- The frontend must not run AI pipelines, classify notes, determine priorities, call OpenAI, trigger `update life`/`update brain`, or trigger `plan my day`.
- Do not add backend routes such as `POST /api/update-life`, `POST /api/plan-day`, or `POST /api/brain/*`.
- Markdown files are exports/snapshots only, not the source of truth.

## Product Model

- Projects define what I am building.
- Tasks define the work to do.
- `/tasks` is the lightweight task overview.
- `/tasks/:id` is the primary execution workspace.
- Task workspaces should include the execution context needed to start: linked project, objective, priority, next actions, constraints, acceptance criteria, notes, and optional output details.
- Deliverables are optional output details attached to a task, not a standalone top-level workflow.
- Completion belongs to the task. Do not treat a deliverable as the completion source of truth.
- Start Day should generate rich task workspaces, not just one-line task titles.
- During day planning, every generated or updated task must be evaluated for agent executability.
- Agent-executable means any task where an AI agent can produce a meaningful first draft, implementation, analysis, or completed output.
- Agent-executable examples include software implementation, bug fixes, UI/UX changes, refactoring, tests, documentation, research, content writing, design briefs, data processing, and structured planning or analysis.
- If a task is agent-executable, generate a complete copy-paste-ready execution prompt and save it to `task.codexPrompt`.
- Do not print generated task prompts in the day plan output; store them only in the task workspace.
- Leave `codexPrompt` empty only when no useful AI execution prompt can be generated.