import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Surfaces TASK-034, TASK-035, and TASK-057 (Task 11) cleaned; these must never
// carry bright color utilities.
//
// The storefront carve-out from TASK-034/035 is now CLOSED: cart, products, and
// categories were the last deferred (shop) routes (originally left out because
// TASK-036/037/043 were expected to rebuild them), and TASK-057 Task 11 swept
// their bright utilities and added them below instead of waiting on those
// rebuild tasks. Every customer-facing route group under src/app/(shop) and
// src/app/(auth) is now scanned — none of it is deferred anymore. The home page
// joined in TASK-035 (`(shop)/page.tsx`, `src/components/home`, `src/content`);
// `(shop)/account` and `(shop)/checkout` joined in TASK-034 (each had one
// offender, neutralized); the whole `(auth)` group (login/register) was already
// verified clean; and the shared root-level files every route tree passes
// through — `(shop)/layout.tsx`, the root `error.tsx`, and the root
// `layout.tsx` — were already verified clean too.
//
// Coverage predating all three of the above tasks (added 2026-07-18, before
// TASK-034 existed) that this narrative doesn't otherwise mention:
// `src/app/newsletter`, `src/app/not-found.tsx`, and `src/lib/order-status.ts`
// are also in SCAN_PATHS below and verified clean — listed here so the
// account above isn't read as the complete map of what's scanned.
//
// Also deliberately NOT in this list, for unrelated reasons:
// - src/app/(admin) — admin is inheriting design tokens but is not being restyled
//   by TASK-034/057 (BACKLOG'd, no rebuild task owns it yet), so it's still not in
//   SCAN_PATHS. Note its OrderStatus chips ARE already monochrome: both admin
//   orders pages were converted to the shared getOrderStatusStyle() in TASK-034.
//   TASK-057 Task 11's admin pass spot-fixed two hardcoded-light-background
//   offenders it found while clicking through (newsletter's "Active" badge,
//   suppliers/[id]'s stat-icon circles) without adding admin to SCAN_PATHS — a
//   point fix, not a sweep. G13 (TASK-039) deleted both PAYMENT_STATUS_COLORS
//   and the supplier-order status map outright, replacing them with
//   catalog-driven monochrome lookups. What remains bright in admin now is
//   the pre-existing decorative set: the orders/[id] timeline's green-500,
//   the reviews page's yellow-400 star rating, and the supplier
//   connection-test CheckCircle2 icons (suppliers list + suppliers/[id]) —
//   none of it status-badge chrome, all of it outside SCAN_PATHS regardless.
// - src/components/ui/ — shadcn primitives. Token-driven and managed by the shadcn
//   CLI, not hand-edited.
// - src/app/showcase and the .bold/.luxury/.organic theme blocks — the showcase
//   demo intentionally keeps its bright theme variants.
const SCAN_PATHS = [
  "src/components/common",
  "src/components/home",
  "src/components/reviews",
  "src/components/products",
  "src/components/shop",
  "src/components/checkout",
  "src/content",
  "src/app/newsletter",
  "src/lib/order-status.ts",
  "src/app/not-found.tsx",
  "src/app/(shop)/page.tsx",
  "src/app/(shop)/account",
  "src/app/(shop)/checkout",
  "src/app/(shop)/cart",
  "src/app/(shop)/products",
  "src/app/(shop)/categories",
  "src/app/(shop)/layout.tsx",
  "src/app/(auth)",
  "src/app/error.tsx",
  "src/app/layout.tsx",
];

// Numbered bright-hue utilities across every color-bearing utility prefix. gray /
// slate / zinc / neutral / stone are hueless neutrals, not "bright" colors, and are
// intentionally left out of the hue alternation below — they're in scope for the
// design system but not for this guard. The sanctioned destructive red is applied
// via the `--destructive` token (text-destructive, bg-destructive, ...), never a
// numbered utility like red-500, so token usage never trips this pattern.
//
// `chart` is in the alternation too, even though it isn't a Tailwind hue name:
// `--chart-1` through `--chart-5` are registered as real utilities via `@theme
// inline` in globals.css (`--color-chart-1: var(--chart-1)`, etc.), and `--chart-1`
// itself is chromatic orange (`oklch(0.646 0.222 41.116)`) — intentionally so, for
// admin analytics data-vis, never for a customer-facing surface. A `bg-chart-1` in
// a scanned file is exactly as much a violation as `bg-orange-500` would be, so the
// digit count below is widened to `\d{1,3}` to also match chart's single-digit
// suffixes (1-5) alongside the standard two/three-digit Tailwind shades (50-950).
const BRIGHT =
  /\b(?:bg|text|border|from|to|via|ring|fill|stroke|divide|outline|shadow|accent|caret|decoration)-(?:red|blue|green|yellow|amber|orange|purple|indigo|pink|emerald|teal|cyan|sky|violet|rose|lime|fuchsia|chart)-\d{1,3}\b/;

function walk(path: string): string[] {
  const st = statSync(path);
  if (st.isFile()) return path.match(/\.(tsx?|css)$/) ? [path] : [];
  return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
}

describe("no bright colors in customer-facing scope", () => {
  const files = SCAN_PATHS.flatMap(walk).filter((f) => !f.includes(".test."));

  // Guard against a vacuous pass: it.each([]) below would register zero tests and
  // the suite would go green while checking nothing — the worst failure mode for a
  // regression guard (e.g. a renamed/moved SCAN_PATHS directory silently disarms
  // it). Fail loudly instead if the file list is ever empty.
  it("scans a non-empty set of files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s has no bright color utilities", (file) => {
    const lines = readFileSync(file, "utf8").split("\n");
    const hits = lines
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => BRIGHT.test(line))
      .map(({ n, line }) => `${file}:${n}  ${line.trim()}`);
    expect(hits, `Bright color utilities found:\n${hits.join("\n")}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Token-layer guard: everything above scans class names in TSX/CSS files. It
// says nothing about globals.css's own custom-property VALUES — if `--primary`
// were changed to a chromatic hex literal directly, no scanned file's class
// names would change, and every test above would stay green while the actual
// color definitions went bright. This block closes that gap by parsing the
// token declarations themselves.
// ---------------------------------------------------------------------------
describe("token-layer color policy (globals.css Mirox tokens are achromatic)", () => {
  const GLOBALS_CSS_PATH = "src/app/globals.css";
  const css = readFileSync(GLOBALS_CSS_PATH, "utf8");

  // Non-color custom properties that legitimately live inside the same :root
  // block as the color tokens: radius, font-family refs, motion timing, and
  // box-shadow values. They aren't colors at all, so they're exempt rather
  // than expected to pass a color check. --shadow-soft is a multi-layer
  // box-shadow (achromatic rgb(0 0 0 / a) drops) — not a color token, so it
  // is exempt like the timing tokens.
  const NON_COLOR_PROPS = new Set([
    "--radius",
    "--font-heading",
    "--font-body",
    "--font-serif",
    "--ease-mirox",
    "--duration-fast",
    "--duration-base",
    "--duration-slow",
    "--shadow-soft",
  ]);

  // --chart-1..5 and --sidebar-* are declared inside the very same :root block
  // as the Mirox semantic tokens (they are NOT off in some separate part of
  // the file), but they are deliberately excluded from the Mirox palette
  // check below:
  //   - chart-*  is intentionally chromatic admin-analytics data-vis color
  //     (distinct hues differentiate series on a graph) — see the BRIGHT
  //     regex guard above, which is what actually polices chart tokens
  //     leaking into customer-facing class names.
  //   - sidebar-* is admin chrome. Its oklch values are already achromatic
  //     by inspection (chroma 0 in every entry), but they're expressed as
  //     `oklch(L 0 0)` rather than the Mirox `#RRGGBB` convention this guard
  //     checks, and they're admin-only regardless.
  // Listed by exact property name so the exclusion is explicit and
  // reviewable, not an accidental byproduct of a shape/format guess.
  const ADMIN_ONLY_PROPS = new Set([
    "--chart-1",
    "--chart-2",
    "--chart-3",
    "--chart-4",
    "--chart-5",
    "--sidebar",
    "--sidebar-foreground",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
    "--sidebar-border",
    "--sidebar-ring",
  ]);

  // The sanctioned hues: destructive red, and amber for star ratings (used by
  // StarRating site-wide, reviews pages included — intended, per design).
  // Must still resolve to a valid hex color, just not required to be
  // achromatic.
  // --available: sanctioned green for the PDP stock line and the reviews'
  // verified-purchase badge (TASK-037, per Mirox Product.dc.html) — the same
  // deliberate-exception mechanism as --rating.
  const SANCTIONED_HUE_PROPS = new Set([
    "--destructive",
    "--destructive-foreground",
    "--rating",
    "--available",
  ]);

  function extractBlock(selectorPattern: RegExp): string {
    const match = selectorPattern.exec(css);
    if (!match) {
      throw new Error(`Could not find a block matching ${selectorPattern} in ${GLOBALS_CSS_PATH}`);
    }
    return match[1];
  }

  function parseDeclarations(block: string): Array<{ prop: string; value: string }> {
    return block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("--"))
      .map((line) => {
        const [prop, ...rest] = line.split(":");
        return { prop: prop.trim(), value: rest.join(":").replace(/;\s*$/, "").trim() };
      });
  }

  // The block has no nested rules inside it (flat custom-property
  // declarations only), so matching up to the first `}` safely captures the
  // whole block. `data-surface` no longer exists in this file (TASK-057
  // folded the section-inversion tokens into `:root` and deleted the
  // override block), so `:root` is the only block left to parse.
  const rootDeclarations = parseDeclarations(extractBlock(/:root\s*{([^}]*)}/));

  const colorDeclarations = rootDeclarations.filter(
    ({ prop }) => !NON_COLOR_PROPS.has(prop) && !ADMIN_ONLY_PROPS.has(prop)
  );

  // Same vacuous-pass guard as the class-name scan above: if the block
  // regexes ever stop matching (e.g. globals.css gets restructured), fail
  // loudly instead of silently checking zero tokens.
  it("finds a non-empty set of Mirox color tokens to check", () => {
    expect(colorDeclarations.length).toBeGreaterThan(0);
  });

  it.each(colorDeclarations.map(({ prop, value }): [string, string] => [prop, value]))(
    "%s: %s is achromatic hex (or the sanctioned destructive hue)",
    (prop, value) => {
      const hexMatch = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
      expect(hexMatch, `${prop}: "${value}" is not a #RRGGBB hex color`).not.toBeNull();

      if (SANCTIONED_HUE_PROPS.has(prop)) return;

      const [, r, g, b] = hexMatch!;
      const achromatic = r.toLowerCase() === g.toLowerCase() && g.toLowerCase() === b.toLowerCase();
      expect(
        achromatic,
        `${prop}: "${value}" is chromatic (R≠G≠B) and is not a sanctioned hue token`
      ).toBe(true);
    }
  );
});
