import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSeedPassword } from "../../prisma/seed-data/users";
import { DISCOVERY_ARGS, gitLines } from "../helpers/discovery";

// G17 / F1: the seeded ADMIN password was a source-controlled literal that
// prisma/seed.ts bcrypt-hashed into an unconditional Role.ADMIN upsert, and
// the README republished it. A published seed password is a working login on
// any database ever seeded from the repo; the test customers are the same
// class.
//
// These tests fail against the pre-fix tree and are the regression guard.

const repoRoot = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

// Every plaintext credential the seed used to carry, as published.
const LEAKED_SECRETS = ["admin123", "customer123", "password123"];

// Every LIVE doc, discovered rather than listed.
//
// PR #43 review finding 7: this was a hardcoded three-entry list, and the same
// PR added a live plan doc that republished all three passwords verbatim — in
// neither the swept set nor the exemption class. The invariant this test states
// ("no live doc republishes a seed password") is only worth stating if it is
// checked against every live doc, so the set is derived now.

// Includes untracked, non-ignored markdown: see the note in
// json-ld-escaping.test.ts — a new doc must trip this before it is staged.
// The --others --exclude-standard pair is load-bearing and pinned by
// tests/unit/discovery-untracked.test.ts.
function discoverLiveDocs(): string[] {
  return gitLines(DISCOVERY_ARGS.markdown, repoRoot);
}

const LIVE_DOCS = discoverLiveDocs();

describe("seed credentials are not hard-coded (G17 F1)", () => {
  // Both seed files, not just the data module: the first version of this guard
  // checked only seed-data/users.ts and missed a second hard-coded copy in
  // seed.ts's summary block, which `tsc` caught rather than this test.
  it.each(["prisma/seed-data/users.ts", "prisma/seed.ts"])(
    "%s carries no plaintext password literal",
    (file) => {
      const source = read(file);
      for (const secret of LEAKED_SECRETS) {
        expect(source, `"${secret}" is still a literal in ${file}`).not.toContain(secret);
      }
      // Belt and braces: no `password:` data field at all on the seed users.
      expect(source).not.toMatch(/^\s*password:\s*["'`]/m);
    }
  );

  it("discovers the live docs rather than trusting a hardcoded list", () => {
    // An empty or tiny set would make the sweep below vacuously pass.
    expect(LIVE_DOCS.length).toBeGreaterThanOrEqual(5);
    expect(LIVE_DOCS).toContain("README.md");
    expect(LIVE_DOCS).toContain("docs/ARCHITECTURE.md");
  });

  it("no live doc republishes a seed password", () => {
    for (const doc of LIVE_DOCS) {
      const source = read(doc);
      for (const secret of LEAKED_SECRETS) {
        expect(source, `${doc} still publishes "${secret}"`).not.toContain(secret);
      }
    }
  });
});

describe("resolveSeedPassword (G17 F1)", () => {
  const generate = () => "generated-value";

  it("uses the environment value when one is set", () => {
    expect(resolveSeedPassword("from-env", { isLocalHost: true, generate })).toBe("from-env");
    expect(resolveSeedPassword("from-env", { isLocalHost: false, generate })).toBe("from-env");
  });

  it("generates a value for local development when the env var is unset", () => {
    expect(resolveSeedPassword(undefined, { isLocalHost: true, generate })).toBe("generated-value");
    expect(resolveSeedPassword("", { isLocalHost: true, generate })).toBe("generated-value");
  });

  it("refuses to invent a password for a non-local database", () => {
    // The failure mode this closes: a remote seed silently planting an account
    // whose password nobody chose and nobody knows to rotate.
    expect(() => resolveSeedPassword(undefined, { isLocalHost: false, generate })).toThrow(
      /SEED_ADMIN_PASSWORD/
    );
    expect(() => resolveSeedPassword("", { isLocalHost: false, generate })).toThrow(
      /SEED_ADMIN_PASSWORD/
    );
  });

  it("rejects a whitespace-only environment value rather than seeding it", () => {
    expect(() => resolveSeedPassword("   ", { isLocalHost: false, generate })).toThrow(
      /SEED_ADMIN_PASSWORD/
    );
  });
});
