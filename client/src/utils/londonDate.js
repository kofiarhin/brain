const londonDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getLondonDateKey(date = new Date()) {
  const parsedDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '';

  const parts = Object.fromEntries(
    londonDateFormatter.formatToParts(parsedDate)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addLondonDays(dateKey, days) {
  const [year, month, day] = String(dateKey || getLondonDateKey()).split('-').map(Number);
  if (!year || !month || !day) return '';
  return getLondonDateKey(new Date(Date.UTC(year, month - 1, day + days, 12)));
}

export function nextWeekendLondonDate(todayLondonDate = getLondonDateKey()) {
  const [year, month, day] = todayLondonDate.split('-').map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  const londonWeekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(noonUtc);
  const weekdayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(londonWeekday);
  if (weekdayIndex < 0) return addLondonDays(todayLondonDate, 1);
  if (weekdayIndex < 5) return addLondonDays(todayLondonDate, 5 - weekdayIndex);
  return addLondonDays(todayLondonDate, weekdayIndex === 5 ? 1 : 6);
}
