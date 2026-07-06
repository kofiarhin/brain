function text(value, fallback = '') {
  return String(value || fallback).trim();
}

function date(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function joinList(values) {
  return (values || []).map((value) => text(value?.title || value)).filter(Boolean).join('; ');
}

function lineItems(items, mapper, limit = 5) {
  return (items || []).slice(0, limit).map(mapper).filter(Boolean);
}

function taskLine(task) {
  const parts = [
    text(task.title, 'Untitled task'),
    task.priority ? `priority ${task.priority}` : '',
    task.dueDate ? `due ${date(task.dueDate)}` : '',
    task.scheduledFor ? `scheduled ${date(task.scheduledFor)}` : '',
  ].filter(Boolean);
  return `- ${parts.join(' | ')}`;
}

function projectLine(project) {
  const parts = [
    text(project.name, 'Untitled project'),
    project.priority ? `priority ${project.priority}` : '',
    project.executionState ? `state ${project.executionState}` : '',
    project.progressPercent !== undefined && project.progressPercent !== null ? `${project.progressPercent}%` : '',
  ].filter(Boolean);
  const blockers = joinList(project.blockers);
  return `- ${parts.join(' | ')}${blockers ? `\n  Blockers: ${blockers}` : ''}`;
}

function goalLine(goal) {
  const parts = [text(goal.title, 'Untitled goal'), goal.category, goal.status].filter(Boolean);
  return `- ${parts.join(' | ')}`;
}

export function buildLocalChatFallback({ contextBundle }) {
  const context = contextBundle || {};
  const sections = [
    'The hosted AI provider is unavailable, so this is a local read-only summary from your saved Brain App data.',
  ];

  const tasks = lineItems(context.openTasks, taskLine, 8);
  if (tasks.length) sections.push(`Open tasks:\n${tasks.join('\n')}`);

  const projects = lineItems(context.activeProjects, projectLine, 5);
  if (projects.length) sections.push(`Active projects:\n${projects.join('\n')}`);

  const goals = lineItems(context.activeGoals, goalLine, 5);
  if (goals.length) sections.push(`Active goals:\n${goals.join('\n')}`);

  if (context.todayOrLatestDayPlan) {
    const dayPlan = context.todayOrLatestDayPlan;
    const facts = [
      dayPlan.focus ? `Focus: ${dayPlan.focus}` : '',
      joinList(dayPlan.mustDo) ? `Must do: ${joinList(dayPlan.mustDo)}` : '',
      joinList(dayPlan.shouldDo) ? `Should do: ${joinList(dayPlan.shouldDo)}` : '',
      joinList(dayPlan.winCondition) ? `Win condition: ${joinList(dayPlan.winCondition)}` : '',
    ].filter(Boolean);
    if (facts.length) sections.push(`Latest saved day plan:\n${facts.join('\n')}`);
  }

  const notes = lineItems(context.relevantNotes, (note) => `- ${text(note.content)}`, 5);
  if (notes.length) sections.push(`Relevant notes:\n${notes.join('\n')}`);

  if (sections.length === 1) {
    sections.push('I did not find enough saved context to answer this well. Add or update tasks, projects, goals, notes, or context, then try again.');
  } else {
    sections.push('Recommendation: use these saved items as the current facts, then retry chat when the provider is reachable for deeper reasoning.');
  }

  return sections.join('\n\n');
}
