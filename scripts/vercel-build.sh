#!/usr/bin/env bash
# Vercel production/preview build.
#
# Why this exists: nothing else applies Prisma migrations to the deployed
# database. There is no GitHub Actions deploy job (the old no-op one was
# retired in G28, 2026-10-07), and the plain `build` script (prisma generate &&
# next build) never migrates. As a result the production schema silently drifted
# months behind the repo (the `reviews` and `subscribers` tables were never
# created there), which took the homepage down the moment a server-side review
# query landed on it. Running `prisma migrate deploy` here keeps the deployed
# DB in step with the committed migrations on every deploy.
#
# Vercel runs `vercel-build` in preference to `build` when it is present, so
# CI (which calls `npm run build` directly) is unaffected.
#
# Connection: Prisma Migrate needs a *direct* (non-pooled) connection — Neon's
# pooled endpoint (the `-pooler` host used for serverless runtime queries) does
# not reliably support the session advisory lock migrate takes. Set DIRECT_URL
# in the Vercel project env to the direct Neon endpoint (same connection string
# as DATABASE_URL, with `-pooler` removed from the host). Runtime keeps using
# the pooled DATABASE_URL.
#
# migrate is intentionally NON-FATAL: the app render path is resilient (a failed
# data query degrades to a hidden section rather than a 500), so a migration
# problem must not block the deploy and strand the site on the previous, broken
# build. A failure is logged loudly here and is visible in the build logs.
set -euo pipefail

echo "▶ vercel-build: applying database migrations (prisma migrate deploy)"
if [ -n "${DIRECT_URL:-}" ]; then
  # Point migrate at the direct endpoint without disturbing the runtime
  # DATABASE_URL (pooled) used by the app.
  if DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy; then
    echo "✓ migrations applied"
  else
    echo "⚠ WARNING: prisma migrate deploy FAILED — deploying anyway in degraded mode."
    echo "  Features backed by unmigrated tables (reviews, newsletter) will be unavailable"
    echo "  until migrations succeed. Check DIRECT_URL points at the direct (non-pooled) Neon endpoint."
  fi
else
  echo "⚠ WARNING: DIRECT_URL is not set — skipping migrations. Set it in the Vercel"
  echo "  project environment (direct, non-pooled Neon endpoint) so deploys stay in"
  echo "  step with committed migrations. Deploying in degraded mode."
fi

echo "▶ vercel-build: prisma generate"
npx prisma generate

# Vercel restores the previous deployment's `.next/cache` before this script
# runs. Production has served new HTML against CSS missing every Tailwind
# utility the change introduced (after PR #35, and on every deploy after PR #46
# until G22), and the PR #46 case was measured to come from Next's persistent
# webpack cache inside it: a CSS module compiled from an OLDER tree. Changed
# source did not reliably invalidate that module, although Next does forward
# Tailwind's file dependencies to webpack — the root cause is not identified.
# Deleting the compile cache makes every build compile from the checked-out
# tree, at the price of a cold compile (measured on Vercel: 8–12 s cached,
# ~30 s cold). `node_modules` and `.next/cache/eslint` stay cached.
echo "▶ vercel-build: clearing the webpack build cache (.next/cache/webpack)"
rm -rf .next/cache/webpack

echo "▶ vercel-build: next build"
npx next build
