#!/usr/bin/env node
/**
 * i18n byte-diff (TASK-039 spec §2 "extraction law"): every Cyrillic string
 * fragment REMOVED from src/** on this branch must appear verbatim inside
 * messages/uk.json. Catches transcription corruption («цінує»→«цінює» class).
 * Deliberate rewrites go in scripts/i18n-byte-diff-allow.txt (one fragment
 * per line) with a plan-log entry.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const BASE = process.env.I18N_DIFF_BASE || "main";
const CYR = /[Ѐ-ӿ]/;

const diff = execSync(`git diff ${BASE}...HEAD -- 'src/**/*.ts' 'src/**/*.tsx'`, {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const uk = readFileSync("messages/uk.json", "utf8");
const allow = new Set(
  existsSync("scripts/i18n-byte-diff-allow.txt")
    ? readFileSync("scripts/i18n-byte-diff-allow.txt", "utf8")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    : []
);

const removedLines = diff
  .split("\n")
  .filter((l) => l.startsWith("-") && !l.startsWith("---") && CYR.test(l));

const literalRe = /(["'`])((?:\\.|(?!\1).)*)\1/g;
const misses = [];

for (const line of removedLines) {
  const fragments = [];
  let m;
  let matchedLiteral = false;
  while ((m = literalRe.exec(line))) {
    if (!CYR.test(m[2])) continue;
    matchedLiteral = true;
    // template interpolations become ICU args — verify the Cyrillic parts between them
    for (const frag of m[2].split(/\$\{[^}]*\}/)) fragments.push(frag.trim());
  }
  if (!matchedLiteral) {
    // fallback for multi-line template literals (no complete quote pair on this diff line)
    for (const run of line.matchAll(/[Ѐ-ӿ][Ѐ-ӿ'’ʼ\s.,:;!?…«»()-]*[Ѐ-ӿ]/g)) {
      fragments.push(run[0].trim());
    }
  }
  for (const f of fragments) {
    if (!CYR.test(f) || f.length < 2 || allow.has(f)) continue;
    if (!uk.includes(f)) misses.push({ frag: f, line: line.slice(0, 140) });
  }
}

if (misses.length) {
  console.error(
    `i18n byte-diff: ${misses.length} removed Cyrillic fragment(s) missing from messages/uk.json (base ${BASE}):`
  );
  for (const x of misses) console.error(`  MISSING «${x.frag}»\n    from: ${x.line}`);
  process.exit(1);
}
console.log(
  `i18n byte-diff clean (base ${BASE}): every removed Cyrillic fragment found verbatim in messages/uk.json.`
);
