# Agent Module: Brain Maintenance

## Notes Processing Trigger

When I say `update life` or `update brain`:

1. Read the latest notes from MongoDB.
2. Classify each note.
3. Update the relevant MongoDB collections.
4. Preserve raw notes unless I explicitly ask to clear or archive them.
5. If the command is `update brain`, save exactly one `BrainUpdateReport` to MongoDB after the update.
6. Summarize what changed.
7. Do not generate, start, restart, upsert, or print a day plan.

Running `update brain` ends immediately after:

- Notes are processed.
- Collections are updated.
- Exactly one `BrainUpdateReport` is written.
- A concise summary is printed.

It must never continue into planning.

## Information Routing

Route information like this:

- Long-term outcomes -> `goals`.
- Active work, blockers, next actions, and client work -> `projects` and/or `tasks`.
- Product, content, photography, videography, creator, business, or software ideas -> `ideas`.
- Durable life facts, family context, routines, constraints, recurring patterns, and working style -> `contextitems`.
- Editable planning, scheduling, output, and agent behavior preferences -> `preferences`.
- Daily wins, challenges, lessons, accomplishments, and tomorrow items -> `reviews`.
- Concrete outputs -> optional output details on the relevant `tasks`.
- Temporary or unclear notes remain in `notes` unless there is a clear destination.