const requiredDayPlanArrayFields = ['priorities', 'schedule', 'mustDo', 'shouldDo', 'niceToHave', 'unclearItems'];

export function validateDayPlan(dayPlan, command) {
  const errors = [];
  if (!dayPlan) errors.push('DayPlan was not created.');
  if (dayPlan && dayPlan.status !== 'active') errors.push('DayPlan must be active.');
  if (dayPlan && command === 'good-morning' && dayPlan.sessionType !== 'start') errors.push('good morning must create a start session.');
  if (dayPlan && command === 'replan-day' && dayPlan.sessionType !== 'restart') errors.push('replan day must create a restart session.');
  for (const field of requiredDayPlanArrayFields) {
    if (dayPlan && !Array.isArray(dayPlan[field])) errors.push(`DayPlan.${field} must be an array.`);
  }
  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.statusCode = 500;
    throw error;
  }
}

export function commandResult({ command, status = 'success', ids = {}, warnings = [], errors = [], counts = {} }) {
  return {
    command,
    status,
    ids,
    warnings,
    errors,
    counts,
  };
}
