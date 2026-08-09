/**
 * CSV cell encoding for the app's exports (#682).
 *
 * There were two escapers — one in `services/api/auditApi.ts`, one in
 * `components/ScanFindingsModal.tsx` — and they had already diverged: the first
 * quoted every cell unconditionally, the second only when the value contained a
 * quote, comma or newline. Neither did anything about formula injection, so
 * fixing them separately would have meant fixing the same defect twice and
 * leaving whichever export gets written next to repeat it.
 *
 * ## Formula injection
 *
 * Excel, LibreOffice Calc and Google Sheets evaluate a cell whose FIRST
 * character is `=`, `+`, `-`, `@`, tab or carriage return. RFC 4180 quoting does
 * not prevent this: the spreadsheet strips the quotes and then evaluates what is
 * inside, so `"=cmd|'/c calc'!A1"` still runs on open.
 *
 * The values here are attacker-influenceable. An audit log row carries
 * `user_email`, `user_name` and `resource_id`; a scan finding carries `title`,
 * `resource` and `file`, which come from third-party scanner output about
 * third-party module content. The person who opens the export is an
 * administrator.
 *
 * The neutraliser is a leading apostrophe, which spreadsheets consume as
 * "treat the rest as literal text" and which is what OWASP recommends. It is
 * applied INSIDE the quotes so the CSV grammar is untouched: a reader that is
 * not a spreadsheet still sees the apostrophe as data, which is the honest
 * trade — the alternative is silently dropping characters the user typed.
 */

/** Leading characters that make a spreadsheet evaluate the cell as a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/

/**
 * Encode one value as a CSV cell: neutralise a formula lead, escape embedded
 * quotes, and always quote.
 *
 * Always quoting is deliberate. Conditional quoting is one predicate to get
 * wrong, and the failure is a corrupted export rather than a loud error.
 */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  const neutralised = FORMULA_LEAD.test(s) ? `'${s}` : s
  return `"${neutralised.replace(/"/g, '""')}"`
}

/** Encode a header + rows as a CSV document, with every cell run through csvCell. */
export function toCsv(header: readonly string[], rows: readonly unknown[][]): string {
  return [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n')
}
