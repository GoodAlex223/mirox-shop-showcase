import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Production served new HTML against stale CSS after PR #35, and again on every
 * deploy after PR #46. Vercel restores the previous build's `.next/cache`; for
 * the PR #46 case, deleting Next's persistent webpack cache inside it was
 * measured to turn a stale build (0 of 7 new utilities) into a correct one
 * (7 of 7). The PR #35 case was never measured. `scripts/vercel-build.sh`
 * therefore deletes the webpack cache before `next build` (G22).
 *
 * This runs the REAL script with a fake `npx` that records, at the moment each
 * command runs, whether the webpack cache still exists. A test that only read
 * the script's text would pass with the `rm` placed after `next build`.
 */
const SCRIPT = resolve("scripts/vercel-build.sh");

describe("scripts/vercel-build.sh", () => {
  let dir = "";

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function runBuildScript(): string[] {
    dir = mkdtempSync(join(tmpdir(), "vercel-build-"));
    mkdirSync(join(dir, ".next/cache/webpack/client-production"), { recursive: true });
    writeFileSync(join(dir, ".next/cache/webpack/client-production/0.pack"), "stale");
    mkdirSync(join(dir, ".next/cache/eslint"), { recursive: true });
    writeFileSync(join(dir, ".next/cache/eslint/.cache"), "{}");

    const bin = join(dir, "bin");
    mkdirSync(bin);
    writeFileSync(
      join(bin, "npx"),
      [
        "#!/usr/bin/env bash",
        "state=absent",
        "[ -e .next/cache/webpack ] && state=present",
        'echo "npx $* webpack=$state" >> npx-calls.log',
        "",
      ].join("\n")
    );
    chmodSync(join(bin, "npx"), 0o755);

    // Guards the guard: a seeding failure would make "absent" pass vacuously.
    expect(existsSync(join(dir, ".next/cache/webpack/client-production/0.pack"))).toBe(true);

    // A minimal environment: no DIRECT_URL, so the script skips migrations
    // rather than reaching for a real database.
    execFileSync("bash", [SCRIPT], {
      cwd: dir,
      env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir },
      stdio: "pipe",
    });

    return readFileSync(join(dir, "npx-calls.log"), "utf8").trim().split("\n");
  }

  it("deletes the webpack build cache before next build runs", () => {
    const calls = runBuildScript();
    const nextBuilds = calls.filter((line) => line.startsWith("npx next build "));

    expect(nextBuilds).toEqual(["npx next build webpack=absent"]);
  });

  it("keeps the rest of the restored cache", () => {
    runBuildScript();

    // The purge is scoped to compiled output. Widening it to all of .next/cache
    // is a deliberate change that should come with an edit to this assertion.
    expect(existsSync(join(dir, ".next/cache/eslint/.cache"))).toBe(true);
  });
});
