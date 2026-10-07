import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DISCOVERY_ARGS, gitLines } from "../helpers/discovery";

// PR #43 review round 3 raised this as an observation rather than a finding:
// the --untracked / --others --exclude-standard behaviour is now load-bearing,
// but nothing asserted it. Every non-triviality guard in the three structural
// tests is satisfied by tracked files alone, so removing a flag would silently
// reopen the pre-stage blind spot those flags were added to close, and no test
// would go red.
//
// This pins the argv itself against a scratch repository rather than the real
// one. Creating probe files inside the project would race the other suites —
// vitest runs files in parallel workers, and a stray .md or ld+json site is
// exactly what the other guards are hunting for.

let repo: string;

function git(...args: string[]) {
  execFileSync("git", args, { cwd: repo, stdio: "ignore" });
}

function write(relative: string, contents: string) {
  const full = join(repo, relative);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, contents, "utf8");
}

// One probe body carrying every pattern the guards search for, so a single
// tracked/untracked pair exercises all four argv sets.
const PROBE = [
  'type="application/ld+json"',
  '"Content-Type": "text/csv"',
  '"Content-Disposition": \'attachment; filename="x.csv"\'',
].join("\n");

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "discovery-pin-"));
  git("init", "--quiet");
  git("config", "user.email", "pin@example.com");
  git("config", "user.name", "Discovery Pin");

  write(".gitignore", "ignored/\n");
  write("src/tracked.tsx", PROBE);
  write("tracked.md", "# tracked\n");
  git("add", "-A");
  git("commit", "--quiet", "-m", "tracked baseline");

  // Never staged — the case the flags exist for.
  write("src/untracked.tsx", PROBE);
  write("untracked.md", "# untracked\n");

  // Ignored — must stay invisible even with the widened lookup, or the guards
  // would start auditing node_modules and .next.
  write("ignored/leaked.tsx", PROBE);
  write("ignored/leaked.md", "# ignored\n");
});

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

describe("guard discovery sees unstaged files (PR #43 r3)", () => {
  it.each([
    ["jsonLd", "src/untracked.tsx"],
    ["csvType", "src/untracked.tsx"],
    ["csvDownload", "src/untracked.tsx"],
    ["markdown", "untracked.md"],
  ] as const)("%s discovery finds %s before it is staged", (key, expected) => {
    expect(gitLines(DISCOVERY_ARGS[key], repo)).toContain(expected);
  });

  it.each([
    ["jsonLd", "src/tracked.tsx"],
    ["csvType", "src/tracked.tsx"],
    ["csvDownload", "src/tracked.tsx"],
    ["markdown", "tracked.md"],
  ] as const)("%s discovery still finds tracked %s", (key, expected) => {
    expect(gitLines(DISCOVERY_ARGS[key], repo)).toContain(expected);
  });

  it.each(["jsonLd", "csvType", "csvDownload", "markdown"] as const)(
    "%s discovery excludes ignored paths",
    (key) => {
      // The cost of widening: --exclude-standard is what stops this becoming a
      // sweep of every dependency in the tree.
      expect(gitLines(DISCOVERY_ARGS[key], repo).join("\n")).not.toContain("ignored/");
    }
  );
});
