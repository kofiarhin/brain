# Brain MVP Implementation Specification v1.0

## Vision

Brain is **not** an AI chat application.

Brain is a **Personal AI Operating System**.

The user manages structured information through a CRUD interface while
**Codex CLI** performs reasoning and decision-making.

The entire product revolves around three daily workflows:

-   🌅 **good morning**
-   🔄 **replan day**
-   🌙 **update brain**

Everything else exists to support these workflows.

------------------------------------------------------------------------

# Core Principles

## React

Responsible only for CRUD, dashboards, visualisation and reports. Never
performs AI reasoning.

## Express API

Responsible only for CRUD endpoints, validation, authentication and
persistence. Never reasons.

## MongoDB

Responsible for long-term memory, relationships, historical data and
reports. Always the source of truth.

## Codex CLI

Responsible for reading memory, reasoning, planning, decision making and
writing results.

No browser AI. No frontend prompt execution.

# Authentication

Continue using:

``` env
AUTH_USERNAME=...
AUTH_PASSWORD=...
```

No OAuth, Clerk, Auth0, Google Login or multi-user support.

# Collections

-   Notes
-   Tasks
-   Projects
-   Goals
-   Ideas
-   Context
-   Deliverables
-   Reviews
-   Preferences
-   DayPlans
-   BrainUpdateReports

# Daily Workflow

``` text
04:00
↓
good morning
↓
Execute work
↓
(optional)
replan day
↓
Continue execution
↓
22:00
update brain
```

# good morning

## Purpose

Starts the day and creates today's execution plan.

### Reads

-   Open tasks
-   Active projects
-   Focus projects
-   Active goals
-   Open deliverables
-   Recent reviews
-   Context
-   Preferences
-   Previous day plans
-   Latest Brain Update Report

### Creates

Exactly one active DayPlan.

### Updates

-   Archive previous active DayPlan
-   Update task scheduling
-   Update task priorities

### Never

-   Update projects
-   Update goals
-   Process notes
-   Archive tasks
-   Create BrainUpdateReport

### Output

-   Morning briefing
-   Priorities
-   Schedule
-   Focus
-   Win condition
-   Risks
-   Motivation

# replan day

## Purpose

Rebuild today's plan after interruptions.

### Reads

-   Active DayPlan
-   Open tasks
-   Open deliverables
-   Projects
-   Goals
-   Context
-   Preferences

### Creates

Exactly one restart DayPlan.

### Updates

Previous DayPlan status = restarted.

### Never

-   Duplicate tasks
-   Create morning plan
-   Update projects/goals
-   Create BrainUpdateReport

### Output

-   Updated schedule
-   Updated priorities
-   Deferred work
-   Explanation

# update brain

## Purpose

Maintain long-term memory.

### Reads

Everything.

### Creates

Exactly one BrainUpdateReport.

### Updates

-   Projects
-   Goals
-   Ideas
-   Context
-   Deliverables
-   Task links
-   Knowledge links
-   Reviews

### Never

-   Create/restart DayPlan
-   Generate tomorrow's plan
-   Create today's tasks
-   Schedule work

### Output

-   Brain Update Report
-   Memory improvements
-   Project updates
-   Goal updates
-   Recommendations
-   Warnings

# Collection Ownership

  Collection           good morning    replan day       update brain
  -------------------- --------------- ---------------- ----------------
  DayPlans             Create          Restart/Create   Read
  Tasks                Read/Schedule   Read/Reorder     Update/Archive
  Projects             Read            Read             Update
  Goals                Read            Read             Update
  Notes                Read            Read             Process
  Ideas                Read            Read             Update
  Context              Read            Read             Update
  Deliverables         Read            Read             Update
  Reviews              Read            Read             Create/Update
  Preferences          Read            Read             Read
  BrainUpdateReports   Read            Read             Create

# Frontend

CRUD only. Displays: - Dashboard - Today's Plan - Tasks - Projects -
Goals - Notes - Deliverables - Reviews - Brain Reports - Preferences

No AI chat or prompt execution.

# Automation

-   04:00 → good morning
-   Manual → replan day
-   22:00 → update brain

# Locked Edge Cases

1.  Missed scheduled runs execute once after wake.
2.  Never carry forward completed/archived/dismissed/converted tasks.
3.  Ignore blocked/completed/abandoned/archived/ready_for_production
    projects.
4.  Respect `Preference.planning.maxDailyTasks` (default 5).
5.  Use `Europe/London` and `londonDate` consistently.
6.  Validate AI output before persistence.
7.  Prevent duplicate tasks using normalized title + scheduled London
    date.

# Acceptance Criteria

## good morning

-   One active DayPlan
-   Previous archived
-   Morning briefing
-   Capacity-aware
-   No long-term memory updates

## replan day

-   Requires active DayPlan
-   Marks previous restarted
-   One replacement DayPlan
-   No duplicate tasks

## update brain

-   One BrainUpdateReport
-   Long-term memory only
-   No day planning

# Out of Scope

-   AI chat
-   Browser AI
-   Multi-user
-   OAuth
-   Billing
-   Teams
-   Plugins
-   Notifications
-   Mobile

# Product Definition

Brain is a personal AI operating system built around three workflows:

-   🌅 good morning
-   🔄 replan day
-   🌙 update brain
