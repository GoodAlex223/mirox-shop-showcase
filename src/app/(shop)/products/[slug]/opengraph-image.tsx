import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { siteConfig } from "@/lib/seo";
import { formatPrice } from "@/lib/format";
import { loadManropeForOg } from "@/lib/og-fonts";

// Mirox palette (matches src/app/globals.css :root, the default dark
// theme): #000000 background, #0d0d0d card panel, #1a1a1a muted/border,
// #ffffff foreground, #a3a3a3 secondary text. Seeded product photography is
// shot on a near-black studio background (see public/images/products/), so
// the image-mount panel is dark too — a white panel would box a dark photo
// in a jarring bright rectangle.
//
// Product name and formatPrice()'s currency suffix are Ukrainian (Tasks 3/5),
// and Satori's bundled fallback font is Latin-only, so — same as the
// site-wide src/app/opengraph-image.tsx — a Cyrillic-capable font is
// fetched at render time (see src/lib/og-fonts.ts) with a safe fallback if
// that fetch fails.
export const alt = "Product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Ghosted brand mark (TASK-057 Task 9) — same pre-baked asset and rationale
// as src/app/opengraph-image.tsx: public/images/og-logo-ghost.png is already
// blurred (sigma 12) and dimmed (~10% opacity) by the generating script, so
// no CSS filter is applied to the <img> here (Satori doesn't support one).
// Painted on both the real product card and the "not found" fallback below,
// so every OG card this route can produce carries it, not just the common case.
const GHOST_LOGO_WIDTH = 1290;
const GHOST_LOGO_HEIGHT = 630;

// Embedded as a base64 data URI (read once at module load), not fetched via
// an absolute HTTP URL — unlike the per-request product photo below (which
// must stay a URL fetch, since it's genuinely dynamic S3/seed data), this
// asset is a fixed local file, so there is no reason to route it through a
// self-fetch at all. This route happens to be dynamic today (server-rendered
// per request, so a siteConfig.url-based fetch back to its own running
// server does work here — verified by rendering), but that's incidental to
// having a `[slug]` param, not a guarantee: adding `generateStaticParams`
// here in the future (e.g. to pre-build OG cards for top products) would
// silently reintroduce the exact build-time fetch failure this data URI
// avoids on the sibling root route (src/app/opengraph-image.tsx — see its
// comment for the full story). A data: URI has no such failure mode.
const GHOST_LOGO_DATA_URL = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public/images/og-logo-ghost.png"))
  .toString("base64")}`;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    select: {
      name: true,
      price: true,
      images: {
        select: { url: true },
        orderBy: { position: "asc" as const },
        take: 1,
      },
    },
  });

  if (!product) {
    const fonts = await loadManropeForOg(siteConfig.name);
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          background: "#000000",
          color: "#ffffff",
          fontSize: 48,
          fontWeight: 700,
          fontFamily: "Manrope",
        }}
      >
        <img
          src={GHOST_LOGO_DATA_URL}
          alt=""
          width={GHOST_LOGO_WIDTH}
          height={GHOST_LOGO_HEIGHT}
          style={{ position: "absolute", left: 96, top: 0 }}
        />
        {siteConfig.name}
      </div>,
      { ...size, ...(fonts.length ? { fonts } : {}) }
    );
  }

  const formattedPrice = formatPrice(Number(product.price));

  // Satori (next/og's renderer) fetches <img src> itself server-side and
  // requires an absolute URL — it throws "Image source must be an absolute
  // URL" for the root-relative paths seed/local data stores (e.g.
  // "/images/products/p-hudi-basic.png"), which crashed this route for
  // every seeded product. new URL(url, base) resolves relative paths
  // against the site origin while passing already-absolute URLs (S3)
  // through unchanged.
  const rawImageUrl = product.images[0]?.url;
  const imageUrl = rawImageUrl ? new URL(rawImageUrl, siteConfig.url).toString() : undefined;
  const displayName = product.name.length > 80 ? product.name.slice(0, 77) + "..." : product.name;
  const ogText = `${siteConfig.name}${displayName}${formattedPrice}`;
  const fonts = await loadManropeForOg(ogText);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#000000",
        padding: 60,
        fontFamily: "Manrope",
      }}
    >
      {/* Ghosted brand mark, painted first so the image panel and text below overlap it. */}
      <img
        src={GHOST_LOGO_DATA_URL}
        alt=""
        width={GHOST_LOGO_WIDTH}
        height={GHOST_LOGO_HEIGHT}
        style={{ position: "absolute", left: 96, top: 0 }}
      />

      {/* Product image */}
      {imageUrl ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 420,
            height: 510,
            background: "#0d0d0d",
            border: "1px solid #1a1a1a",
            borderRadius: 16,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <img
            src={imageUrl}
            alt={product.name}
            width={380}
            height={380}
            style={{ objectFit: "contain" }}
          />
        </div>
      ) : null}

      {/* Text content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          marginLeft: imageUrl ? 60 : 0,
          flex: 1,
        }}
      >
        <div style={{ fontSize: 28, color: "#a3a3a3", fontWeight: 600 }}>{siteConfig.name}</div>

        <div
          style={{
            fontSize: 48,
            color: "#ffffff",
            fontWeight: 700,
            lineHeight: 1.2,
            marginTop: 20,
            overflow: "hidden",
          }}
        >
          {displayName}
        </div>

        <div
          style={{
            fontSize: 64,
            color: "#ffffff",
            fontWeight: 800,
            marginTop: 24,
          }}
        >
          {formattedPrice}
        </div>
      </div>
    </div>,
    { ...size, ...(fonts.length ? { fonts } : {}) }
  );
}
