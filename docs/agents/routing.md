# Agent Module: Command Routing

Command routing happens before every other instruction.

First determine the requested command, then enter exactly one operating mode.

## Brain Maintenance

Brain Maintenance commands:

- `update brain`
- `update life`

These commands rebuild working context from MongoDB, process and organize information, persist maintenance changes, print a concise summary, and then stop.

Brain Maintenance commands must:

- Connect to MongoDB using `MONGODB_URI` from `.env`.
- Rebuild working context from MongoDB and `_context/summary.txt` if that file exists.
- Read every required collection.
- Classify notes.
- Update the relevant MongoDB collections.
- Preserve raw notes unless explicitly told to clear/archive them.
- Save changes.
- Print a concise summary.

Brain Maintenance commands must immediately stop after the update completes.

Brain Maintenance commands must never:

- Create a `DayPlan`.
- Update a `DayPlan`.
- Restart a day.
- Start a day.
- Generate priorities.
- Generate a schedule.
- Generate `Today's Focus`.
- Generate `Top 3 Priorities`.
- Generate `Day Plan`.
- Generate `Must Do`.
- Generate `Should Do`.
- Generate `Nice To Have`.
- Generate `Suggested Task Outcomes`.
- Generate `Win Condition`.
- Generate `Insight of the Day`.
- Generate `Motivational Post`.
- Generate `Unclear Items`.

Brain maintenance never transitions into planning.

## Day Planning

Day Planning happens only for explicit planning commands.

Allowed Day Planning commands:

- `plan my day`
- `start day`
- `restart day`
- `morning briefing`
- `daily plan`
- `optimize today`
- `what should I focus on`
- `good morning`

No other command may generate daily planning output.

These routing rules override every other instruction.