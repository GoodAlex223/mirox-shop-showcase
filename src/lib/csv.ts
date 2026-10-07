/**
 * CSV serialization for admin exports.
 *
 * Export rows carry values that originated in unauthenticated request bodies —
 * guest checkout shipping addresses, item names, newsletter e-mails — and land
 * in a spreadsheet the shop owner opens. Quoting alone is not enough: Excel,
 * LibreOffice and Sheets evaluate a cell whose value starts with `=`, `+`, `-`
 * or `@` as a formula, which makes `=HYPERLINK(...)` an exfiltration primitive
 * and a legacy DDE payload a command-execution one.
 *
 * G17 finding F4: the order export had a weaker private copy of this logic that
 * quoted but did not neutralise formulas, while the newsletter export did it
 * correctly. One shared sink now, so the next export route cannot repeat it.
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Quote a single cell and neutralise any leading formula character. */
export function escapeCsvCell(cell: unknown): string {
  const raw = cell === null || cell === undefined ? "" : String(cell);
  const escaped = raw.replace(/"/g, '""');
  // A leading single quote makes spreadsheets treat the rest as literal text.
  return FORMULA_LEAD.test(escaped) ? `"'${escaped}"` : `"${escaped}"`;
}

/** Render rows (header row included) as CSV, escaping every cell. */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}
