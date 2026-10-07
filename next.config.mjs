import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin(); // default path: ./src/i18n/request.ts

/**
 * Hosts next/image is allowed to fetch from.
 *
 * This used to be `hostname: "**"`, which made the unauthenticated
 * `/_next/image?url=` endpoint a server-side fetch proxy for ANY https URL —
 * an SSRF probe into whatever network the deployment sits in, and a bandwidth
 * amplifier besides (G17 finding F6).
 *
 * The only remote origin the storefront ever loads is the configured CDN / R2
 * public bucket, so the allow-list is derived from AWS_CLOUDFRONT_URL (the same
 * variable src/lib/s3.ts builds image URLs from — see its single env contract:
 * R2 reuses the AWS_* slots, there are no R2_* variables). Seeded product
 * images are root-relative paths served from public/, which next/image handles
 * with no remotePatterns entry at all — so an empty list is correct when no CDN
 * is configured, not a regression.
 */
function cdnRemotePatterns() {
  // Mirrors src/lib/s3.ts's CDN_URL resolution exactly, and must keep doing so:
  // this list has to allow whatever host that module WRITES into
  // ProductImage.url, or the optimizer refuses images the app itself stored.
  // The bucket fallback is legal only on the legacy real-AWS path — once
  // S3_ENDPOINT is set, getPresignedUploadUrl throws MissingCdnUrlError rather
  // than persisting an *.s3.amazonaws.com url, so nothing lives there to allow.
  const bucket = process.env.AWS_S3_BUCKET;
  const fallback =
    !process.env.S3_ENDPOINT && bucket ? `https://${bucket}.s3.amazonaws.com` : undefined;
  const configured = process.env.AWS_CLOUDFRONT_URL || fallback;
  if (!configured) return [];

  try {
    const { hostname, protocol } = new URL(configured);
    if (!hostname) return [];
    return [{ protocol: protocol.replace(":", "") || "https", hostname }];
  } catch {
    // A malformed value must not break the build; it just allows nothing.
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for Docker/Vercel deployment
  output: "standalone",
  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: cdnRemotePatterns(),
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },
  // Performance optimizations
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
    // The PDP OG route reads public/images/og-logo-ghost.png via
    // fs.readFileSync at module scope (data-URI embedding for Satori), but
    // Vercel's function bundle doesn't trace public/ assets — prod 500'd with
    // ENOENT /var/task/public/images/og-logo-ghost.png. Force-include it for
    // the products subtree (route key is a glob; the OG route's generated
    // name carries a hash suffix, so match the whole subtree rather than a
    // brittle exact path).
    outputFileTracingIncludes: {
      "/products/**": ["./public/images/og-logo-ghost.png"],
    },
  },
  // G12: /categories/<slug> is retired in favour of the catalog's category
  // facet. This lives at the routing layer, NOT as a page-level redirect():
  // Next wraps every segment in a RedirectBoundary, so a redirect() thrown
  // inside a Server Component page is captured mid-stream and emitted as
  // `<meta http-equiv="refresh">` on a 200 — verified against a production
  // build — rather than a real 3xx. A redirects() entry emits a genuine 307
  // before any rendering happens. 307, not 308: these URLs stay reclaimable
  // for future category landing pages. `:slug` does not match the bare
  // /categories index, which keeps rendering normally.
  async redirects() {
    return [
      {
        source: "/categories/:slug",
        destination: "/products?category=:slug",
        permanent: false,
      },
    ];
  },
  // Compression
  compress: true,
  // PoweredBy header removal for security
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
