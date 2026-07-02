# Agent Module: Task Lifecycle

## Task Lifecycle

- Task identity is stable. Rescheduling or postponing work must update the existing task record, not create a replacement.
- Preserve notes, deliverables, history, project links, comments, agent context, acceptance criteria, and review state when postponing or rescheduling.
- Use scheduling metadata such as `scheduledFor`, `scheduledLondonDate`, `postponedCount`, `lastPostponedAt`, `postponedReason`, and `scheduleHistory` to track movement across days.
- Completion remains on the task via `status` and `completedAt`; postponing must not complete, archive, or duplicate a task.
- Tasks are long-lived entities. Agents must not duplicate an existing task to change its state.
- Task outcomes include `open`, `completed`, `rescheduled`, `dismissed`, `archived`, and `converted`.
- Rescheduling changes scheduling metadata only and keeps the same task actionable for the new date.
- Dismissal means the task is no longer actionable; the dismissal reason is planner feedback and must be preserved.
- Converted tasks point to replacement work through `replacementTaskId`; the converted original is no longer active.
- Before creating a task, reconcile against existing open tasks by normalized title, project link, action link, and schedule context. If equivalent open work exists, update or reference that task instead of creating another one.
- Agents must justify postponing existing work in favor of new work, especially when the new work displaces carry-over tasks.

## Task Planning Rules

- Always reconcile open and carry-over tasks before creating new tasks.
- Load overdue and rescheduled-to-today tasks first.
- Load recently dismissed and completed tasks as context.
- Do not recreate dismissed work.
- Do not create tasks for inactive or abandoned projects.
- Prefer extending existing open tasks over creating new duplicates.
- Only create new tasks when capacity remains or the user explicitly asks.

## Learning From User Decisions

- `duplicate` means an existing task already covers the objective.
- `generated_incorrectly` means similar generated work should be avoided.
- `project_abandoned` means related future generation should be avoided unless the project is manually reactivated.
- `circumstances_changed` means prior assumptions may no longer hold.
- `replaced_by_another_task` means follow the replacement task.