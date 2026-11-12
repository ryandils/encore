/** Next future wall-clock closing time in an IANA zone; no browser-zone arithmetic. */
export function nextClosingTime(after: number, timeZone: string, time: string): number {
  if (!Number.isFinite(after) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid closing time.');
  const [hour, minute] = time.split(':').map(Number);
  const target = hour * 60 + minute;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const local = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
  };
  let previous = local(after);
  // Search real instants: repeated times select the next occurrence; skipped times
  // select the first valid minute after the forward jump. Midnight rolls dates naturally.
  for (let instant = Math.floor(after / 60000) * 60000 + 60000; instant <= after + 50 * 3600000; instant += 60000) {
    const current = local(instant);
    if (current.minute === target || ((current.day === previous.day && previous.minute < target && current.minute > target) || (current.day !== previous.day && current.minute > target && current.minute < previous.minute))) return instant;
    previous = current;
  }
  throw new Error('Could not resolve the next closing time in this time zone.');
}
