const londonFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function partsInLondon(date) {
  return Object.fromEntries(
    londonFormatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
}

function parseLondonDateKey(londonDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(londonDate);
  if (!match) throw new Error(`Invalid London date: ${londonDate}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function addUtcDays(londonDate, days) {
  const { year, month, day } = parseLondonDateKey(londonDate);
  return getLondonDateKey(new Date(Date.UTC(year, month - 1, day + days, 12)));
}

export function getLondonDateKey(date = new Date()) {
  const parts = partsInLondon(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function londonDateStartUtc(londonDate) {
  const target = parseLondonDateKey(londonDate);
  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, 0, 0, 0, 0);
  let utc = targetAsUtc;

  for (let index = 0; index < 4; index += 1) {
    const parts = partsInLondon(new Date(utc));
    const londonWallClockAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0
    );
    utc -= londonWallClockAsUtc - targetAsUtc;
  }

  return new Date(utc);
}

export function getLondonDayRange(date = new Date()) {
  const londonDate = typeof date === 'string' ? date : getLondonDateKey(date);
  const nextLondonDate = addUtcDays(londonDate, 1);

  return {
    londonDate,
    start: londonDateStartUtc(londonDate),
    end: londonDateStartUtc(nextLondonDate),
  };
}
