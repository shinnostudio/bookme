/**
 * Timezone utilities
 */

/** Format a date string in a specific timezone (YYYY-MM-DD) */
export function formatDateInTz(date: Date, tz: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Returns YYYY-MM-DD
}

/** Format a time string in a specific timezone (HH:mm) */
export function formatTimeInTz(date: Date, tz: string): string {
  return date.toLocaleTimeString('ja-JP', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
