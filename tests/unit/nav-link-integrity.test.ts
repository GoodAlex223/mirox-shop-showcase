import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { SHOP_LINK_GROUPS } from "@/components/common/Footer";

/**
 * The no-dead-links rule (user ruling 2026-07-28) as a test.
 *
 * TASK-035 hid the footer's info links rather than ship 404s, and the rule has
 * been enforced by memory ever since. Stated conventions are not controls:
 * this walks every internal href the chrome renders and asserts a route file
 * exists for it.
 */

const APP_DIR = path.resolve(__dirname, "../../src/app");

const HEADER_SRC = readFileSync(
  path.resolve(__dirname, "../../src/components/common/Header.tsx"),
  "utf8"
);

//
// DEVIATION FROM THE TASK-8 BRIEF, recorded here rather than silently: the
// brief's regex was `/href=\{?"(\/[^"]*)"/g`, which only matches a JSX
// literal (`href="..."` / `href={"..."}`). `navigation`'s entries are
// object-literal properties (`href: "/products"`, colon not equals), so the
// brief's regex cannot see `/products`, `/products?sort=new`,
// `/products?sort=popular` or `/contact` at all — confirmed by running the
// brief's version before this fix, which fails at its own Step 4. Extraction
// below uses the colon form instead.
//

/**
 * Header hrefs, DERIVED from the source file rather than hand-mirrored.
 *
 * Controller ruling R5: Header.tsx is "use client" and importing it drags in
 * next-auth and zustand, so a direct import is impractical — but a hand-copied
 * mirror rots silently, leaving this guard green while the header drifts,
 * which is the exact failure the guard exists to prevent. So: read the file,
 * extract its href literals, and assert the extracted set EQUALS what we
 * expect before walking it.
 *
 * Fix-round-1 (code review finding, "Important"): a **subset** check
 * (`EXPECTED ⊆ extracted`) catches a removed or edited `navigation` entry but
 * not an ADDED one — an appended entry pointing at a page that doesn't exist
 * would simply enlarge the extracted set, the subset check would still hold,
 * and the new href would never reach the route-file assertions below (they
 * only walk `NAV_EXPECTED_HREFS`, not whatever the file happens to contain).
 * That was proved live: inserting a bogus `navigation` entry left the old
 * version of this test at 16/16 green. Fixed by slicing the `navigation =
 * [...] as const;` block out of the source FIRST, extracting hrefs from that
 * slice only, and asserting SET EQUALITY (both directions) against
 * `NAV_EXPECTED_HREFS`. An addition now fails until `NAV_EXPECTED_HREFS` is
 * updated to match — at which point the new href joins `allHrefs` below and
 * gets route-file-checked for real.
 */
const NAV_BLOCK_MATCH = HEADER_SRC.match(/const navigation = \[([\s\S]*?)\] as const;/);
if (!NAV_BLOCK_MATCH) {
  throw new Error(
    "Could not find `const navigation = [...] as const;` in Header.tsx — the derivation this guard depends on has moved or been renamed; update the regex above."
  );
}
const NAV_BLOCK = NAV_BLOCK_MATCH[1];

/**
 * Extracted from the sliced `navigation` block only — plain string-literal
 * `href: "..."` properties.
 *
 * Known blind spot, written down rather than left implicit (per the
 * derivation's whole point: no silent drift): a template-literal or computed
 * `href` inside `navigation` — e.g. `href: \`/foo/${bar}\`` or
 * `href: SOME_CONSTANT` — would match neither this regex nor plausibly
 * `NAV_EXPECTED_HREFS` below, so it would silently vanish from extraction on
 * both sides and never be checked at all, rather than failing loudly. All
 * four current `navigation` entries are plain string literals; if that ever
 * changes, this derivation needs a matching update, not just the
 * expectation list.
 */
const NAV_HREFS = [...NAV_BLOCK.matchAll(/href:\s*"(\/[^"]*)"/g)].map((m) => m[1]);

/**
 * What `navigation` is expected to contain — checked for SET EQUALITY, not
 * subset, against `NAV_HREFS` above. Update deliberately, with the header.
 */
const NAV_EXPECTED_HREFS = [
  "/products",
  "/products?sort=new",
  "/products?sort=popular",
  "/contact",
];

/**
 * The desktop nav also renders a standalone `/categories` `<Link>` OUTSIDE
 * the `navigation` array (see Header.tsx's own G12 comment: folding it into
 * `navigation` would duplicate the mobile sheet's separate «Категорії»
 * entry, since that array feeds both). It isn't part of the sliced block
 * above, so it's asserted present against the full file, separately.
 */
const HAS_CATEGORIES_LINK = /href="\/categories"/.test(HEADER_SRC);

function routeFileFor(href: string): string {
  const pathname = href.split("?")[0].replace(/\/$/, "") || "/";
  const segments = pathname === "/" ? [] : pathname.slice(1).split("/");
  return path.join(APP_DIR, "(shop)", ...segments, "page.tsx");
}

describe("navigation link integrity", () => {
  const footerHrefs = SHOP_LINK_GROUPS.flatMap((g) => g.links.map((l) => l.href));
  const allHrefs = [...NAV_EXPECTED_HREFS, "/categories", ...footerHrefs];

  it("walks a non-empty, independently counted set of links", () => {
    // Guard the guard: 4 nav + /categories + 5 shop + 7 info. A silently
    // emptied SHOP_LINK_GROUPS or NAV_EXPECTED_HREFS would otherwise make
    // every assertion below vacuous.
    expect(footerHrefs).toHaveLength(12);
    expect(allHrefs).toHaveLength(17);
  });

  it("navigation's real hrefs match the expectation list exactly — additions fail here too", () => {
    // Set equality, both directions, sorted so element order can't mask a
    // mismatch: removing/editing an entry shrinks or changes NAV_HREFS
    // (already caught before this fix); ADDING one grows NAV_HREFS past
    // NAV_EXPECTED_HREFS, which this equality check now also catches — that
    // was the gap the old subset check left open.
    expect([...NAV_HREFS].sort()).toEqual([...NAV_EXPECTED_HREFS].sort());
  });

  it("still sees the standalone /categories link outside the navigation array", () => {
    expect(HAS_CATEGORIES_LINK).toBe(true);
  });

  it.each([...new Set(allHrefs)])("%s resolves to a route file", (href) => {
    const candidate = routeFileFor(href);
    const isRoot = href === "/";
    expect(isRoot || existsSync(candidate)).toBe(true);
  });
});
