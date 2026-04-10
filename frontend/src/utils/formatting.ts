/**
 * Shared date formatting utilities.
 */

/**
 * Format an ISO date string for display.
 *
 * @param dateStr  - An optional ISO-8601 date string.
 * @param fallback - Text returned when `dateStr` is nullish (default `'N/A'`).
 * @returns The locale-formatted date string, or `fallback`.
 */
export function formatDate(dateStr?: string | null, fallback = 'N/A'): string {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleString();
}
