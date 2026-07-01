# Brain MVP -- Detailed Implementation Plan

## Original Request

Inspect `kofiarhin/brain` and generate a detailed repo-only
implementation plan for the locked MVP:

-   good morning
-   replan day
-   update brain

## Confirmed Understanding

-   Windows Task Scheduler is already working and is out of scope.
-   Existing `.env` authentication remains unchanged.
-   React remains CRUD/display only.
-   Codex CLI remains the only AI execution surface.
-   Introduce a command service layer under `server/services/commands`.

## In Scope

-   Command service layer
-   Command documentation
-   Validation and guardrails
-   Day plan improvements
-   Brain update safeguards
-   Frontend display improvements
-   Tests
-   Command scripts

## Out of Scope

-   Windows automation
-   Browser AI
-   SaaS auth
-   Billing
-   Teams
-   AI chat

# Phase 1 -- Command Documentation

Create:

``` text
docs/commands/
├── README.md
├── good-morning.md
├── replan-day.md
└── update-brain.md
```

Each command defines:

-   Purpose
-   Allowed reads
-   Allowed writes
-   Forbidden writes
-   Input context
-   Output contract
-   Failure behaviour
-   Edge cases
-   Test checklist

# Phase 2 -- Command Service Layer

Create:

``` text
server/services/commands/
├── index.js
├── goodMorning.js
├── replanDay.js
└── updateBrain.js
```

### goodMorning.js

-   Read planning context
-   Filter stale projects
-   Exclude closed tasks
-   Respect `Preference.planning.maxDailyTasks`
-   Archive current active DayPlan
-   Create one active DayPlan
-   Validate output
-   Prevent duplicate scheduled tasks

Wrap the existing `startDaySession()` helper.

### replanDay.js

-   Require active DayPlan
-   Preserve completed work
-   Restart current DayPlan
-   Create replacement plan
-   Preserve `sourcePlanId`
-   Prevent duplicate carry-forward tasks
-   Validate output

Wrap the existing `restartDaySession()` helper.

### updateBrain.js

-   Read all memory collections
-   Update long-term memory
-   Create exactly one BrainUpdateReport
-   Never create or restart DayPlans
-   Never schedule work

# Phase 3 -- Shared Utilities

Create:

``` text
commandGuards.js
commandValidation.js
commandContext.js
commandReports.js
```

Responsibilities:

-   Closed task detection
-   Eligible project filtering
-   Single active DayPlan enforcement
-   Payload validation
-   Context loading
-   Failure reporting

# Phase 4 -- Enhance DayPlan Sessions

Improve existing services with:

-   Daily capacity enforcement
-   Stale project filtering
-   Closed task filtering
-   Duplicate carry-forward prevention
-   London date consistency
-   AI validation hooks

# Phase 5 -- Brain Update Guardrails

-   Snapshot DayPlan count before update
-   Run memory update
-   Create BrainUpdateReport
-   Verify DayPlan count unchanged
-   Report warnings/errors on failure

# Phase 6 -- Frontend Display

Display only:

-   Dashboard
-   Active DayPlan
-   Tasks
-   Projects
-   Goals
-   Notes
-   Deliverables
-   Reviews
-   Brain Update Reports
-   Preferences

No AI chat or prompt execution.

# Phase 7 -- Tests

Add tests for:

-   goodMorning
-   replanDay
-   updateBrain
-   commandGuards
-   commandValidation
-   dayPlanSessions

Verify:

-   One active DayPlan
-   No duplicate tasks
-   Capacity respected
-   Stale projects ignored
-   No DayPlan creation during update brain

# Phase 8 -- Command Scripts

Create:

``` text
server/scripts/
├── goodMorning.js
├── replanDay.js
└── updateBrain.js
```

Package scripts:

``` json
{
  "scripts": {
    "brain:good-morning": "node server/scripts/goodMorning.js",
    "brain:replan-day": "node server/scripts/replanDay.js",
    "brain:update-brain": "node server/scripts/updateBrain.js"
  }
}
```

# Phase 9 -- Output Contracts

Each command returns structured JSON describing:

-   command
-   status
-   ids
-   warnings
-   errors
-   created/updated counts

# Phase 10 -- Verification

Run:

``` bash
npm test
npm run brain:good-morning
npm run brain:replan-day
npm run brain:update-brain
```

Confirm:

-   Existing auth unchanged
-   CRUD pages still function
-   No AI routes added
-   DayPlans behave correctly
-   BrainUpdateReports generated correctly

# Acceptance Criteria

-   Three command services implemented
-   Clear separation of responsibilities
-   Existing auth preserved
-   CRUD frontend preserved
-   Locked edge cases implemented
-   Comprehensive tests passing
