# Mirox Shop — e-commerce storefront and admin

[![CI](https://github.com/GoodAlex223/mirox-shop-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/GoodAlex223/mirox-shop-showcase/actions/workflows/ci.yml)

A full-stack online clothing store built for **Mirox Shop**, a Ukrainian clothing brand: a
Ukrainian-language storefront with a Russian toggle, cash-on-delivery checkout with Nova Poshta
delivery, guest order tracking, and an admin panel for the catalog, orders, customers, suppliers,
reviews and newsletter.

Built by **GoodAlex223** — [goodalex223.github.io](https://goodalex223.github.io)

> This repository is a portfolio snapshot of the shop's source code. The working repository, its
> commit history, planning documents, design source files and operational material are private and
> not included.

---

## Highlights

- **Checkout without prepayment.** Guest-capable cash-on-delivery checkout with three Nova Poshta
  delivery methods (branch, courier, parcel locker). The order total is recomputed on the server
  from database prices, never taken from the client.
- **Nova Poshta city → branch picker.** An accessible inline ARIA combobox backed by two server
  proxy routes. Queries are normalized and cached for 24 hours per query. When Nova Poshta
  throttles a request, the server retries with the delay it suggests and then answers
  `503 NP_BUSY` with `Retry-After`. The browser waits out that cooldown before it retries, and the
  form falls back to free-text address fields if the directory stays unavailable.
- **Guest order tracking without accounts.** Order pages render only for the owning session or for
  a holder of a signed, expiring, per-order HMAC cookie. An order-number + e-mail lookup issues
  that cookie, with a per-order lockout (5 failures, 15 minutes). Unknown and unauthorized orders
  get the identical response, so the pages are not an existence oracle.
- **Internationalization in cookie mode** with `next-intl`. Ukrainian is the default; Russian is
  deep-merged over it, so a missing key falls back to Ukrainian instead of breaking the page. The
  admin and legal-page namespaces are stripped from the storefront's client payload; the legal
  pages' text alone would add about 48 KB to every page.
- **Admin panel in Ukrainian.** Products with image uploads to S3-compatible storage (AWS S3 or
  Cloudflare R2, presigned URLs), variants, categories, CSV import, orders, customers, suppliers,
  review moderation with replies, and newsletter management with CSV export.
- **Slugs that follow the official Ukrainian transliteration** (Cabinet of Ministers Resolution
  No. 55/2010), tested against every example pair of the official table.
- **Marketing and SEO.** Transactional e-mail (Resend), double opt-in newsletter with HMAC
  unsubscribe tokens, verified-purchase reviews, JSON-LD with review markup, generated Open Graph
  images, a Zod-validated Google Shopping feed, and GA4 via Google Tag Manager behind cookie
  consent.
- **Hardening with regression tests.** No credentials in the seed (passwords come from the
  environment), a remote-image allow-list derived from the configured CDN, and malformed JSON
  bodies answered with `400` on every public route. A test enumerates the public routes, so a new
  route without the guard fails the suite.
- **Background jobs.** Supplier order forwarding and status sync run as BullMQ workers on Redis.

## Tech stack

| Area      | Technology                                                       |
| --------- | ---------------------------------------------------------------- |
| Framework | Next.js 14 (App Router), React 18, TypeScript (strict)           |
| UI        | Tailwind CSS 4, shadcn/ui (Radix), React Hook Form, Zod          |
| Data      | PostgreSQL, Prisma 6 (Neon serverless adapter in production)     |
| Auth      | NextAuth.js v5 (JWT sessions, Prisma adapter)                    |
| i18n      | next-intl 4 (cookie mode, UA default + RU)                       |
| State     | Zustand (persisted cart and consent)                             |
| Services  | Resend (e-mail), S3 / Cloudflare R2 (images), Nova Poshta API    |
| Jobs      | BullMQ + Redis                                                   |
| Testing   | Vitest + Testing Library (unit), Playwright (E2E)                |
| Hosting   | Vercel; the build script applies Prisma migrations before builds |

Stripe integration code is present but dormant: the shop launched with cash on delivery.

## Testing

- **Unit:** 1,551 tests in 106 files (Vitest, Testing Library) covering API routes, validation,
  components, e-mail templates, SEO output and i18n catalogs.
- **E2E:** 7 Playwright specs. CI runs them on Chromium and WebKit against PostgreSQL 16 and
  Redis 7 service containers.
- **CI:** GitHub Actions runs lint, typecheck, Prettier and unit tests on every push and pull
  request, and E2E on every change that is not documentation-only.

## Project structure

```
src/
├── app/
│   ├── (shop)/        # storefront: catalog, product, cart, checkout, account, track, info/legal pages
│   ├── (admin)/admin/ # admin panel (ADMIN role)
│   ├── (auth)/        # login, register
│   └── api/           # route handlers (public, customer and admin-guarded)
├── components/        # UI by domain; shadcn/ui primitives in components/ui
├── i18n/              # next-intl cookie-mode wiring
├── lib/               # auth, db, validation schemas, Nova Poshta client, S3, SEO, e-mail templates
├── services/          # supplier order forwarding
├── stores/            # Zustand stores
└── workers/           # BullMQ workers
messages/              # uk.json (source of truth) and ru.json catalogs
prisma/                # schema, migrations, seed data (placeholder catalog)
tests/                 # unit/ (Vitest), e2e/ (Playwright)
```

More detail: [architecture](docs/ARCHITECTURE.md), [API endpoints](docs/api/endpoints.md),
[database schema](docs/database/schema.md), [testing strategy](docs/testing/strategy.md).

## Running locally

Requires Node.js 20+ and Docker (for PostgreSQL and Redis).

```bash
npm ci
cp .env.example .env          # fill in NEXTAUTH_SECRET at minimum
docker-compose up -d          # PostgreSQL on 5433, Redis on 6380, Adminer on 8080
npm run db:migrate
npm run db:seed               # placeholder catalog; prints generated test-account passwords
npm run dev
```

Other commands: `npm run workers` (background jobs), `npm run test:run` (unit tests),
`npm run test:e2e` (Playwright), `npm run typecheck`, `npm run lint`.

The seed holds no passwords. It reads `SEED_ADMIN_PASSWORD` and `SEED_CUSTOMER_PASSWORD` from the
environment, or generates one per role for a local database and prints it once.

## Credits

- Development: [GoodAlex223](https://goodalex223.github.io).
- Visual design and the storefront imagery in `public/images` come from a design handoff prepared
  for the store; they are not my work.
- The product and model images are AI-generated placeholders (they carry OpenAI content
  credentials), not photographs of real stock.
- The Mirox Shop name and logo belong to their owner.

## License

No license is granted. The code is published so it can be read as part of my portfolio; all
rights are reserved, and no permission to copy, modify or redistribute it is given.
