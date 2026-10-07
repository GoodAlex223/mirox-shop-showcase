import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_NAME, BRAND_META_SUFFIX, BRAND_TAGLINE } from "@/content/brand";
import { loadManropeForOg } from "@/lib/og-fonts";

// Site-wide share card, generated with code instead of a static PNG so the
// rebrand can never drift from src/content/brand.ts again (the old
// public/og-image.png rendered the literal word "Store" — see BACKLOG.md).
// Same file convention as src/app/(shop)/products/[slug]/opengraph-image.tsx;
// this one lives at the app root so it covers every route that doesn't
// declare a more specific opengraph-image of its own — the product page's
// still wins for /products/[slug] since a more specific segment always
// overrides a less specific one.
//
// Deliberately monochrome (Mirox tokens: #000000 / #ffffff, the same
// dark palette `:root` uses by default in globals.css). BRAND_META_SUFFIX
// and BRAND_TAGLINE are Ukrainian text, and Satori's bundled fallback font
// is Latin-only, so a Cyrillic-capable font must be fetched at render time
// (see src/lib/og-fonts.ts) — this route renders tofu, not a Latin
// transliteration, if that fetch fails, so the fetch is best-effort with a
// safe fallback rather than a hard dependency.
export const alt = BRAND_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Ghosted brand mark (TASK-057 Task 9) — public/images/og-logo-ghost.png is
// PRE-blurred and PRE-dimmed to ~10% opacity (generated once from
// public/images/logo.png via sharp: resize to height 630, scale the alpha
// channel to 10%, gaussian blur sigma 12). No filter is applied to the <img>
// below — Satori (next/og's renderer) doesn't support CSS `filter`, so the
// effect has to already be baked into the asset. Natural dimensions of the
// generated asset (wider than the 1200 canvas at this height — it bleeds off
// the right edge by design, the same oversized-watermark motif as the
// homepage Hero's ghosted mark).
const GHOST_LOGO_WIDTH = 1290;
const GHOST_LOGO_HEIGHT = 630;

// Embedded as a base64 data URI (read once at module load), NOT fetched via
// an absolute HTTP URL. This route has no dynamic segments, so Next.js
// prerenders it ONCE at `next build` time, before any server is listening to
// serve /images/og-logo-ghost.png over HTTP — an absolute-URL <img src> (the
// siteConfig.url-based approach the PDP OG route uses, which works there
// because that route is dynamic/per-request, not statically prerendered)
// failed silently during that build-time prerender ("Can't load image ...
// fetch failed" in the build log), shipping a static asset with NO ghost
// logo at all — caught by rendering and reading the actual built output, not
// by the build's exit code. A data: URI needs no network fetch, so it's
// identical at build time and at runtime.
const GHOST_LOGO_DATA_URL = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public/images/og-logo-ghost.png"))
  .toString("base64")}`;

export default async function Image() {
  const text = `${BRAND_META_SUFFIX}${BRAND_NAME}${BRAND_TAGLINE}`;
  const fonts = await loadManropeForOg(text);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "#000000",
        color: "#ffffff",
        fontFamily: "Manrope",
      }}
    >
      {/* Painted first (in source order, with no z-index) so every text layer below overlaps it. */}
      <img
        src={GHOST_LOGO_DATA_URL}
        alt=""
        width={GHOST_LOGO_WIDTH}
        height={GHOST_LOGO_HEIGHT}
        style={{ position: "absolute", left: 96, top: 0 }}
      />

      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: "#a3a3a3",
        }}
      >
        {BRAND_META_SUFFIX}
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: -2,
          marginTop: 20,
        }}
      >
        {BRAND_NAME}
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 28,
          width: 120,
          height: 2,
          background: "#ffffff",
        }}
      />

      <div
        style={{
          display: "flex",
          fontSize: 26,
          color: "#d4d4d4",
          marginTop: 28,
          maxWidth: 820,
          textAlign: "center",
          justifyContent: "center",
        }}
      >
        {BRAND_TAGLINE}
      </div>
    </div>,
    { ...size, ...(fonts.length ? { fonts } : {}) }
  );
}
