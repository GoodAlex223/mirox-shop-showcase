import { execFileSync } from "node:child_process";

/**
 * The git argv each structural guard uses to DISCOVER its targets.
 *
 * Defined once, here, for a specific reason: the `--untracked` and
 * `--others --exclude-standard` flags are load-bearing. Without them a guard
 * cannot see a file the developer has not staged, and since no hook runs the
 * suite (`.husky/pre-commit` is lint-staged only), the resulting false green
 * survives the commit and only breaks later — in CI, or on some unrelated
 * suite run. Dropping a flag would silently reopen that gap, and every
 * non-triviality assertion in the guards is satisfied by tracked files alone,
 * so nothing else would go red.
 *
 * `tests/unit/discovery-untracked.test.ts` pins these against a scratch
 * repository; the guards import them rather than inlining their own argv.
 */
export const DISCOVERY_ARGS = {
  /** Files embedding a JSON-LD block (G17 F2 guard). */
  jsonLd: ["grep", "-l", "--untracked", "application/ld+json", "--", "src"],
  /** Files declaring a CSV response type (G17 F4 guard, first half). */
  csvType: ["grep", "-l", "--untracked", "text/csv", "--", "src"],
  /** Files naming a download (G17 F4 guard, second half — emitter, not consumer). */
  csvDownload: ["grep", "-l", "--untracked", "Content-Disposition", "--", "src"],
  /** Every markdown file, tracked or not, excluding ignored paths (G17 F1 guard). */
  markdown: ["ls-files", "--cached", "--others", "--exclude-standard", "*.md"],
} as const;

/** Run one of the above in `cwd` and return the matched paths. */
export function gitLines(args: readonly string[], cwd: string): string[] {
  return execFileSync("git", [...args], { cwd, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}
