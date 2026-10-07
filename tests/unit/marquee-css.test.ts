import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// G8 TASK-059: the marquee must rejoin the repo's reduced-motion reset —
// a surface override that isn't named in the reset silently keeps animating
// for reduced-motion users. jsdom can't see compiled CSS, so this asserts
// against the source; the visual gate checks the compiled output.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const reduceIdx = css.indexOf("@media (prefers-reduced-motion: reduce)");
const beforeReduce = css.slice(0, reduceIdx);

// Brace-balanced extraction of the media block's exact contents: a
// slice-to-EOF would also match overrides that sit AFTER the block's
// closing brace (unguarded), which is precisely the regression this
// test exists to catch.
function mediaBlockContent(source: string, atRuleIdx: number): string {
  const open = source.indexOf("{", atRuleIdx);
  let depth = 1;
  for (let i = open + 1; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error("Unbalanced braces after @media rule");
}
const reduceBlock = reduceIdx === -1 ? "" : mediaBlockContent(css, reduceIdx);

describe("marquee CSS", () => {
  it("still has the reduced-motion block (guards the slices below from vacuity)", () => {
    expect(reduceIdx).toBeGreaterThan(-1);
    expect(reduceBlock).toContain(".animate-fade-up");
  });

  it("defines the marquee animation before the reduced-motion reset", () => {
    expect(beforeReduce).toContain("@keyframes mirox-marquee");
    expect(beforeReduce).toMatch(/\.animate-marquee\s*\{[^}]*animation:\s*mirox-marquee/);
  });

  it("pauses on hover and keyboard focus", () => {
    expect(beforeReduce).toMatch(
      /\.animate-marquee:hover,\s*\.animate-marquee:focus-within\s*\{[^}]*animation-play-state:\s*paused/
    );
  });

  it("rejoins the reduced-motion reset", () => {
    expect(reduceBlock).toMatch(/\.animate-marquee\s*\{[^}]*animation:\s*none/);
    expect(reduceBlock).toMatch(/\.marquee-duplicate\s*\{[^}]*display:\s*none/);
  });
});
