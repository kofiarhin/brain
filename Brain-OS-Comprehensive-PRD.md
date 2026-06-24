
# Brain OS v2 – Comprehensive Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Living document / Source of Truth  
**Derived From:** Current repository implementation (`brain`)  
**Last Updated:** 2026-06-24

---

# 1. Executive Summary

Brain OS v2 is a personal operating system built on the MERN stack that centralizes an individual's knowledge, planning, execution, and reflection workflows.

The product treats:

- **MongoDB** as persistent memory
- **React** as the user interface
- **Codex CLI / external AI tooling** as the reasoning layer
- **Express APIs** as CRUD infrastructure

The application intentionally avoids embedding AI orchestration into the web application itself. The web product acts primarily as a structured knowledge system and operational dashboard.

---

# 2. Product Vision

Provide a single system where a user can:

1. Capture information.
2. Organize projects and goals.
3. Plan daily work.
4. Track execution.
5. Review progress.
6. Enable external AI agents to reason over structured personal data.

---

# 3. Product Principles

- Local-first thinking with cloud persistence.
- Structured data over unstructured notes.
- CRUD-first architecture.
- AI augmentation without coupling AI to the frontend.
- Simple interfaces optimized for speed.

---

# 4. Target Users

## Primary User
Knowledge workers, developers, founders, creators, and operators who need a personal operating system.

## Secondary Users
- Productivity enthusiasts
- Solo entrepreneurs
- Consultants
- Content creators

---

# 5. Core Use Cases

## Capture
- Store notes
- Save ideas
- Preserve context

## Planning
- Create goals
- Define projects
- Build day plans

## Execution
- Manage tasks
- Track deliverables
- Mark completion

## Reflection
- Create reviews
- Review progress over time

## AI Augmentation
External tools read/write data to generate:
- Morning briefings
- Daily plans
- Life updates
- Strategic recommendations

---

# 6. Product Scope

## In Scope

### Notes
Personal notes and knowledge storage.

### Tasks
Actionable work items with lifecycle states.

### Deliverables
Track outputs and shipped work.

### Goals
Long-term objectives.

### Projects
Containers for work initiatives.

### Ideas
Future concepts and opportunities.

### Context
Reference information and background knowledge.

### Reviews
Retrospectives and reflection entries.

### Day Plans
Daily execution plans.

---

## Out of Scope

- Authentication
- Multi-user collaboration
- Embedded AI endpoints
- Notifications
- Permissions and roles
- File storage
- Real-time collaboration
- Team workspaces
- Billing and subscriptions

---

# 7. Functional Requirements

## 7.1 Notes Module

### Users can:
- Create notes
- Edit notes
- Delete notes
- Browse notes

### Acceptance Criteria
- Notes persist in MongoDB.
- CRUD endpoints exist.
- Notes are available via frontend pages.

---

## 7.2 Tasks Module

### Users can:
- Create tasks
- Update tasks
- Delete tasks
- Complete tasks
- Reopen tasks
- Archive tasks

### Acceptance Criteria
- State transitions are persisted.
- Archived tasks remain stored.

---

## 7.3 Deliverables Module

### Users can:
- Create deliverables
- Complete deliverables
- Reopen deliverables
- Archive deliverables

---

## 7.4 Goals Module

### Users can:
- Create goals
- Update goals
- Remove goals
- Review goals

---

## 7.5 Projects Module

### Users can:
- Create projects
- Organize work initiatives
- Edit project metadata
- Remove projects

---

## 7.6 Ideas Module

### Users can:
- Capture ideas
- Maintain an idea backlog

---

## 7.7 Context Module

### Users can:
- Store contextual information
- Maintain persistent memory

---

## 7.8 Reviews Module

### Users can:
- Record retrospectives
- Track lessons learned

---

## 7.9 Day Planning Module

### Users can:
- Create day plans
- Retrieve latest plan
- Maintain historical plans

---

# 8. User Journeys

## Morning Workflow

1. Open dashboard.
2. Review latest day plan.
3. Review tasks and deliverables.
4. Execute priorities.

---

## Project Workflow

1. Create project.
2. Define goals.
3. Add tasks.
4. Deliver outputs.
5. Review progress.

---

## Reflection Workflow

1. Complete work.
2. Create review.
3. Capture lessons.
4. Feed information into future planning.

---

# 9. System Architecture

## Frontend

### Technology
- React
- Vite
- Tailwind CSS
- React Router
- Vitest

### Pages

- Dashboard
- Notes
- Tasks
- Deliverables
- Projects
- Goals & Ideas
- Context
- Reviews
- Day Plan
- Entity View

### Components

- Card
- List
- App Layout

---

## Backend

### Technology
- Node.js
- Express
- MongoDB
- Mongoose
- Jest

### Architecture

Controller Pattern:
- Generic CRUD controller
- Resource-specific routes

### API Resources

- /api/notes
- /api/tasks
- /api/deliverables
- /api/goals
- /api/projects
- /api/ideas
- /api/context
- /api/reviews
- /api/day-plans

---

# 10. Domain Model

## Note
Represents knowledge.

## Task
Represents actionable work.

States:
- Active
- Completed
- Archived

## Deliverable
Represents produced outputs.

States:
- Active
- Completed
- Archived

## Goal
Represents desired outcomes.

## Project
Represents initiatives and bodies of work.

## Idea
Represents opportunities and future concepts.

## Context
Represents supporting information and memory.

## Review
Represents reflection and learning.

## Day Plan
Represents daily execution planning.

---

# 11. API Requirements

All resources support:

- Create
- Read
- Update
- Delete

Additional endpoints:

## Tasks

PATCH:
- complete
- reopen
- archive

## Deliverables

PATCH:
- complete
- reopen
- archive

## Day Plans

GET:
- latest

---

# 12. Non-Functional Requirements

## Performance
- CRUD responses should feel instantaneous.
- Page navigation should remain lightweight.

## Reliability
- MongoDB acts as source of truth.

## Maintainability
- Generic controllers reduce duplication.

## Extensibility
- External AI services can integrate without modifying the web UI.

## Simplicity
- Keep business logic minimal in frontend.

---

# 13. Security Requirements

Current implementation assumptions:

- Single-user environment.
- Trusted deployment.

Future requirements:

- Authentication
- Authorization
- Encryption of secrets
- Audit logs

---

# 14. Risks

## Schema Drift
AI tools may write inconsistent data.

## Lack of Authentication
System unsuitable for public multi-user deployment.

## Manual AI Integration
Requires external workflows.

## Scaling Risks
Current architecture is optimized for personal use.

---

# 15. Future Roadmap

## Phase 1
Current CRUD system.

## Phase 2
Authentication.

## Phase 3
AI orchestration layer.

## Phase 4
Semantic search.

## Phase 5
Knowledge graph.

## Phase 6
Automation engine.

---

# 16. Success Metrics

- Daily active usage
- Tasks completed
- Deliverables shipped
- Reviews created
- Consistent day planning
- Reduced information fragmentation

---

# 17. Definition of Done

The product succeeds when a user can:

1. Capture information.
2. Plan work.
3. Execute tasks.
4. Track deliverables.
5. Reflect on outcomes.
6. Enable external AI systems to reason over structured personal data.

---

# Appendix A – Repository Structure

- client/
- server/
- archive/
- markdown seed files
- tests
- environment configuration

---

# Appendix B – Source of Truth Statement

The current implementation intentionally separates:

**Data Layer**
→ MongoDB

**Interface Layer**
→ React

**Reasoning Layer**
→ External AI/Codex tooling

This separation is a core architectural decision and should be preserved unless an intentional redesign is approved.
