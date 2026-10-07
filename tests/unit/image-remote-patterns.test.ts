import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// G17 / F6 (MEDIUM, 3/3 panel): images.remotePatterns allowed hostname "**", so
// the unauthenticated /_next/image endpoint would fetch ANY https URL
// server-side — an SSRF probe into the deployment's internal network and a
// bandwidth amplifier. Seeded product images are root-relative (public/), so
// the only host that ever needs allowing is the configured CDN/R2 origin.

// PR #43 review finding 5: the allow-list must mirror the SAME resolution
// src/lib/s3.ts uses to BUILD image urls, which is not AWS_CLOUDFRONT_URL alone
// — on the legacy real-AWS path (S3_ENDPOINT unset) it falls back to
// https://<bucket>.s3.amazonaws.com, and MissingCdnUrlError does not fire
// there because its guard is `endpoint && !CLOUDFRONT_URL`. Deriving from the
// CDN variable alone left that configuration persisting urls the optimizer
// would then refuse. Production (R2, both vars set) was never affected.
const ENV_KEYS = ["AWS_CLOUDFRONT_URL", "AWS_S3_BUCKET", "S3_ENDPOINT"] as const;
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

async function loadConfig() {
  vi.resetModules();
  const mod = await import("../../next.config.mjs");
  return mod.default;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

// Loading next.config.mjs pulls in the next-intl plugin, which is slow on a
// cold module graph; the 5s default times out when the full suite is running
// all workers. Timeout is per-test, so this only reserves headroom.
const LOAD_TIMEOUT = 30_000;

describe("next.config images.remotePatterns (G17 F6)", () => {
  it(
    "never allows a wildcard hostname",
    async () => {
      process.env.AWS_CLOUDFRONT_URL = "https://cdn.example.net";
      const config = await loadConfig();
      const hostnames = (config.images?.remotePatterns ?? []).map(
        (p: { hostname: string }) => p.hostname
      );
      expect(hostnames).not.toContain("**");
      expect(hostnames).not.toContain("*");
      for (const h of hostnames) {
        expect(h, `"${h}" is a bare wildcard`).not.toMatch(/^\*+$/);
      }
    },
    LOAD_TIMEOUT
  );

  it(
    "allows the configured CDN host",
    async () => {
      process.env.AWS_CLOUDFRONT_URL = "https://pub-abc123.r2.dev";
      const config = await loadConfig();
      const hostnames = (config.images?.remotePatterns ?? []).map(
        (p: { hostname: string }) => p.hostname
      );
      expect(hostnames).toContain("pub-abc123.r2.dev");
    },
    LOAD_TIMEOUT
  );

  it(
    "tolerates a CDN url with a trailing slash or path",
    async () => {
      process.env.AWS_CLOUDFRONT_URL = "https://cdn.example.net/";
      const config = await loadConfig();
      const hostnames = (config.images?.remotePatterns ?? []).map(
        (p: { hostname: string }) => p.hostname
      );
      expect(hostnames).toContain("cdn.example.net");
    },
    LOAD_TIMEOUT
  );

  it(
    "allows no remote host at all when no CDN is configured",
    async () => {
      // Local development serves product images from public/ as root-relative
      // paths, which next/image handles without any remotePatterns entry. An
      // empty list is therefore correct, not a regression — but only when no
      // bucket is configured either, otherwise s3.ts's fallback host applies.
      delete process.env.AWS_CLOUDFRONT_URL;
      delete process.env.AWS_S3_BUCKET;
      delete process.env.S3_ENDPOINT;
      const config = await loadConfig();
      expect(config.images?.remotePatterns ?? []).toEqual([]);
    },
    LOAD_TIMEOUT
  );

  it(
    "ignores an unparsable CDN url rather than crashing the build",
    async () => {
      process.env.AWS_CLOUDFRONT_URL = "not a url";
      const config = await loadConfig();
      expect(config.images?.remotePatterns ?? []).toEqual([]);
    },
    LOAD_TIMEOUT
  );
  it(
    "allows the bucket host on the legacy AWS path, where s3.ts falls back to it",
    async () => {
      // S3_ENDPOINT unset => real AWS => CDN_URL falls back to the bucket host
      // and MissingCdnUrlError never fires. Persisted urls point there, so the
      // optimizer has to accept it or every product image 400s.
      delete process.env.AWS_CLOUDFRONT_URL;
      delete process.env.S3_ENDPOINT;
      process.env.AWS_S3_BUCKET = "mirox-legacy";
      const config = await loadConfig();
      expect(config.images?.remotePatterns).toEqual([
        { protocol: "https", hostname: "mirox-legacy.s3.amazonaws.com" },
      ]);
    },
    LOAD_TIMEOUT
  );

  it(
    "does not apply the bucket fallback once an S3_ENDPOINT is set",
    async () => {
      // R2 without a CDN url is a configuration s3.ts refuses at call time
      // (MissingCdnUrlError), so nothing is ever persisted on that host and
      // allowing it would only widen the optimizer for no reason.
      delete process.env.AWS_CLOUDFRONT_URL;
      process.env.S3_ENDPOINT = "https://acct.r2.cloudflarestorage.com";
      process.env.AWS_S3_BUCKET = "example-bucket";
      const config = await loadConfig();
      expect(config.images?.remotePatterns ?? []).toEqual([]);
    },
    LOAD_TIMEOUT
  );

  it(
    "prefers the configured CDN over the bucket fallback",
    async () => {
      process.env.AWS_CLOUDFRONT_URL = "https://cdn.example.net";
      process.env.AWS_S3_BUCKET = "mirox-legacy";
      delete process.env.S3_ENDPOINT;
      const config = await loadConfig();
      expect(config.images?.remotePatterns).toEqual([
        { protocol: "https", hostname: "cdn.example.net" },
      ]);
    },
    LOAD_TIMEOUT
  );
});
