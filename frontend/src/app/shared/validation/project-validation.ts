/** Match the API's character count without treating emoji as two characters. */
export function projectTextError(value: string): string | null {
  if (!value.trim()) return 'This field is required.';
  if ([...value.trim()].length > 200) return 'Use 200 characters or fewer.';
  if (value.includes('\u0000')) return 'Null characters are not allowed.';
  return null;
}

/** Calendar values stay strings throughout the form and API request. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}
