/**
 * Safely extracts a YYYY-MM-DD string from any birthdate value (string, ISO string, Date object)
 * preserving the local calendar day and avoiding UTC timezone shifts.
 */
export function extractBirthdateString(val: any): string {
  if (!val) return '1960-01-01';

  if (typeof val === 'string') {
    const trimmed = val.trim();
    // If it's already in pure YYYY-MM-DD format (no time component)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // If it's an ISO string with time (e.g. 1992-08-21T16:00:00.000Z)
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return trimmed.split('T')[0];
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '1960-01-01';
}

/**
 * Formats a birthdate for display (e.g. "Aug 22, 1992") without UTC timezone shifts.
 */
export function formatBirthdateDisplay(val: any): string {
  if (!val) return 'Not specified';
  const dateStr = extractBirthdateString(val);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }
  return dateStr;
}
