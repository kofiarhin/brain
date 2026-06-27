# Data Flow Audit – Fix Handoff

## Objective

Audit and harden the application's data flow to eliminate false UI state, API shape inconsistencies, duplicate data, and unexpected runtime errors.

---

# Critical Issues

## 1. Dashboard Shows False Success State

**Severity:** Critical

**Problem**
The dashboard uses `Promise.allSettled()` and silently substitutes failed API responses with empty arrays or `null`.

**Impact**

- API failures appear as:
  - 0 tasks
  - healthy system
  - empty datasets

- Users cannot distinguish between "no data" and "failed request."

**Required Fix**

- Surface partial API failures.
- Display error/partial-loading states.
- Never interpret failed requests as valid empty results.

---

## 2. Generic CRUD Allows Duplicate Records

**Severity:** High

**Problem**
Generic CRUD controllers persist `req.body` directly without uniqueness validation.

**Impact**
Duplicate:

- Goals
- Notes
- Ideas
- Context
- Deliverables
- Reviews
- Projects

can be created unintentionally.

**Required Fix**

- Add resource-specific uniqueness rules.
- Introduce normalized keys or unique indexes where appropriate.
- Reject accidental duplicates.

---

## 3. Frontend Supports Actions Missing From Backend

**Severity:** High

**Problem**
The frontend exposes actions like:

- archive
- reopen
- complete

for every resource, while backend routes only implement them for selected resources (e.g. Tasks).

**Impact**
Produces:

- 404s
- Cast errors
- Invalid PATCH requests
- Route mismatches

**Required Fix**

- Keep frontend resource capabilities in sync with backend routes.
- Only expose supported actions.

---

## 4. Project Progress Uses Wrong Field

**Severity:** High

**Problem**
Analytics ignores the actual `progressPercent` field and falls back to guessed values.

**Impact**
Dashboard displays inaccurate project completion percentages.

**Required Fix**
Use the canonical project progress field consistently throughout the application.

---

## 5. Client and Server Use Different "Today" Logic

**Severity:** Medium

**Problem**
Frontend calculates "today" using browser local time while backend uses Europe/London.

**Impact**
Near midnight or across time zones:

- due tasks
- overdue counts
- daily metrics
- trends

can disagree.

**Required Fix**
Centralize date calculations and use the same timezone logic on both client and server.

---

## 6. Completed Timestamp May Be Stale

**Severity:** Critical

**Problem**
`completedAt` is created during server initialization instead of per request.

**Impact**
Multiple completed tasks may receive the same timestamp until the server restarts.

**Required Fix**
Generate timestamps inside request handlers.

---

## 7. Day Plan Parser Ignores Valid Item Shapes

**Severity:** Medium

**Problem**
Task generation only recognizes certain object shapes (`title`, `name`, `description`).

Other valid formats (e.g. `activity`) are ignored.

**Impact**
Valid plan items fail to become tasks.

**Required Fix**
Normalize supported input shapes before processing.

---

## 8. Day Plan Upsert Overwrites User Data

**Severity:** High

**Problem**
Generated day plans update existing tasks and overwrite manually edited fields.

**Impact**
Users lose:

- descriptions
- acceptance criteria
- categories
- metadata
- custom edits

**Required Fix**
Only update generated fields or merge safely while preserving user-authored data.

---

## 9. Inconsistent Day Plan Identity

**Severity:** Medium

**Problem**
One workflow creates new Day Plans while another updates today's existing plan.

**Impact**
Can produce:

- multiple plans for one day
- incorrect active plan
- confusing dashboard state

**Required Fix**
Define a single source of truth for Day Plan identity and creation/update behavior.

---

# Recommended Refactor

Introduce a shared data contract across the application:

- Single canonical API response shape.
- Shared TypeScript/Zod schemas for client and server.
- Centralized DTO mapping.
- Consistent date/time handling.
- Resource capability registry (supported actions).
- Validation before persistence.
- Safe merge strategy for updates.
- Explicit loading/error states instead of silent fallbacks.

---

# Priority Order

1. Fix false dashboard success state.
2. Fix stale `completedAt` timestamps.
3. Align frontend actions with backend routes.
4. Correct project progress mapping.
5. Unify timezone/date calculations.
6. Prevent duplicate records.
7. Normalize Day Plan input shapes.
8. Preserve user-authored task fields during upserts.
9. Consolidate Day Plan creation/update workflow.

---

# Acceptance Criteria

- API failures are never shown as valid empty data.
- Duplicate records are prevented where appropriate.
- Frontend only exposes supported backend actions.
- Dashboard progress matches stored project progress.
- Client/server calculate dates identically.
- Every completion receives an accurate timestamp.
- Day Plan generation supports all valid input shapes.
- User edits survive automated updates.
- Only one authoritative Day Plan exists for a given day.
