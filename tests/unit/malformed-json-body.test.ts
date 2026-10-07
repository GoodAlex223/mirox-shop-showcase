import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createNextRequest, createRouteParams } from "../helpers/api-test-utils";

/**
 * A malformed request body is the CALLER's error, not ours.
 *
 * `await request.json()` throws a SyntaxError on a body that isn't valid
 * JSON. Every one of these handlers wraps its work in a try/catch whose
 * fallback is a 5xx — so before G20 a client that sent `{"oops"` was told the
 * SERVER had failed. Browsers never hit this (they send what our forms
 * serialize); non-browser clients and integrators do, and a 500 tells them to
 * retry a request that can never succeed.
 *
 * The fix is the idiom G18 established in `api/orders/lookup/route.ts`:
 * `await request.json().catch(() => null)`, letting `null` fall into the
 * validation each route already runs. No route gains a branch.
 *
 * These tests are deliberately behavioral (assert the status a real caller
 * sees) and are paired with a source-level enumeration guard at the bottom
 * that fails when a NEW public route is added without the idiom — the
 * behavioral tests can only protect routes someone remembered to list.
 */

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendFeedbackEmail: vi.fn().mockResolvedValue({ success: true }),
  sendNewsletterConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    subscriber: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    product: { findMany: vi.fn() },
    review: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    order: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { POST as feedbackPost } from "@/app/api/feedback/route";
import { POST as subscribePost } from "@/app/api/newsletter/subscribe/route";
import { POST as unsubscribePost } from "@/app/api/newsletter/unsubscribe/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as createOrderPost } from "@/app/api/checkout/create-order/route";
import { POST as confirmOrderPost } from "@/app/api/checkout/confirm-order/route";
import { POST as reviewsPost } from "@/app/api/reviews/route";
import { PUT as reviewPut } from "@/app/api/reviews/[id]/route";
import { POST as lookupPost } from "@/app/api/orders/lookup/route";
import { POST as paymentIntentPost } from "@/app/api/checkout/create-payment-intent/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const SESSION = { user: { id: "user-1", email: "c@example.com", role: "CUSTOMER" } };

/** Bodies that are not parseable JSON. Empty string is the one a proxy or a
 *  `fetch` with no body actually produces in the wild. */
const MALFORMED = ['{"email": ', "not json at all", "", "{{}}"];

beforeEach(() => {
  vi.clearAllMocks();
  // These two routes run requireAuth() BEFORE touching the body, so without a
  // session they'd answer 401 and the test would pass for the wrong reason.
  mockAuth.mockResolvedValue(SESSION);
  // PUT /api/reviews/[id] additionally resolves and ownership-checks the
  // review before it ever reads the body — unmocked it answers 404, which
  // would make "not a 500" look like a pass while the parse stayed untested.
  (prisma.review.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "rev-1",
    userId: SESSION.user.id,
  });
});

function malformedRequest(url: string, method: "POST" | "PUT", rawBody: string) {
  return createNextRequest({ url, method, rawBody });
}

describe("malformed JSON body → 400, never 5xx", () => {
  const cases: {
    name: string;
    url: string;
    method: "POST" | "PUT";
    call: (req: ReturnType<typeof createNextRequest>) => Promise<Response>;
    /** Routes that emit a machine code alongside the status. */
    code?: string;
  }[] = [
    {
      name: "POST /api/feedback",
      url: "/api/feedback",
      method: "POST",
      call: (req) => feedbackPost(req),
      code: "VALIDATION_ERROR",
    },
    {
      name: "POST /api/newsletter/subscribe",
      url: "/api/newsletter/subscribe",
      method: "POST",
      call: (req) => subscribePost(req),
      code: "VALIDATION_ERROR",
    },
    {
      name: "POST /api/newsletter/unsubscribe",
      url: "/api/newsletter/unsubscribe",
      method: "POST",
      call: (req) => unsubscribePost(req),
      code: "VALIDATION_ERROR",
    },
    {
      name: "POST /api/auth/register",
      url: "/api/auth/register",
      method: "POST",
      call: (req) => registerPost(req),
    },
    {
      name: "POST /api/checkout/create-order",
      url: "/api/checkout/create-order",
      method: "POST",
      call: (req) => createOrderPost(req),
      code: "INVALID_ORDER_DATA",
    },
    {
      name: "POST /api/checkout/confirm-order",
      url: "/api/checkout/confirm-order",
      method: "POST",
      call: (req) => confirmOrderPost(req),
    },
    {
      name: "POST /api/reviews",
      url: "/api/reviews",
      method: "POST",
      call: (req) => reviewsPost(req),
    },
    {
      name: "PUT /api/reviews/[id]",
      url: "/api/reviews/rev-1",
      method: "PUT",
      call: (req) => reviewPut(req, createRouteParams({ id: "rev-1" })),
    },
    {
      // Dormant since G2 (no caller), but a public POST handler all the same —
      // and `confirm-order` above is equally dormant, so excluding only this
      // one was an uneven rule rather than a reason (PR #46 review). Both are
      // fixed; there is no exclusion list any more.
      name: "POST /api/checkout/create-payment-intent",
      url: "/api/checkout/create-payment-intent",
      method: "POST",
      call: (req) => paymentIntentPost(req),
    },
    {
      // Already correct — G18 fixed this one, and the same-shaped assertion
      // here keeps it that way rather than trusting the convention to hold.
      name: "POST /api/orders/lookup (G18 regression)",
      url: "/api/orders/lookup",
      method: "POST",
      call: (req) => lookupPost(req),
      code: "VALIDATION_ERROR",
    },
  ];

  for (const route of cases) {
    it(`${route.name} answers 400 on an unparseable body`, async () => {
      for (const raw of MALFORMED) {
        const response = await route.call(malformedRequest(route.url, route.method, raw));
        expect(response.status, `${route.name} with body ${JSON.stringify(raw)}`).toBe(400);
        if (route.code) {
          const json = await response.json();
          expect(json.code, `${route.name} code`).toBe(route.code);
        }
      }
    });
  }

  it("covers every handler the source guard below considers public", () => {
    // Ties the two halves together: if the enumeration finds a public POST
    // route this file never exercises, the behavioral coverage has a hole.
    // Comparing against an independently derived list — not a hardcoded 8 —
    // is what stops this from being a restatement of the array above.
    const listed = new Set(cases.map((c) => c.url.replace(/\/rev-1$/, "/[id]")));
    for (const file of publicJsonRoutes()) {
      const url = "/" + file.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
      expect(listed.has(url), `${url} is public but has no behavioral test here`).toBe(true);
    }
  });
});

/**
 * Public API routes are every `route.ts` under `src/app/api` that parses a
 * JSON body and is NOT admin-guarded. There are deliberately NO exclusions:
 * every such route is fixed and behaviorally tested, so this guard has no
 * escape hatch to drift through. Admin routes are out of scope by ruling
 * (an authenticated administrator is the only reachable caller).
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * Scanned ONCE at module load, not per test. Walking `src/app/api` and
 * reading every route file is cheap on its own, but inside the full suite —
 * 88 files sharing the box — it ran past vitest's 5s per-test budget and
 * failed a green branch. Module scope pays the cost at import, outside any
 * test's timeout, and pays it once for both tests below.
 */
const PUBLIC_JSON_ROUTES: string[] = walk("src/app/api")
  .filter((f) => f.endsWith("route.ts"))
  .filter((f) => !f.includes("api/admin/"))
  .filter((f) => readFileSync(f, "utf8").includes("request.json()"));

function publicJsonRoutes(): string[] {
  return PUBLIC_JSON_ROUTES;
}

describe("public JSON routes guard the parse", () => {
  it("every public route that parses a body uses the .catch() idiom", () => {
    const routes = publicJsonRoutes();
    // An empty list would make every assertion below vacuously pass — the
    // classic shape of a guard that cannot fail. Compare against a floor
    // derived from the routes this suite actually imports.
    expect(routes.length).toBeGreaterThanOrEqual(10);

    const offenders = routes.filter((file) => {
      const src = readFileSync(file, "utf8");
      // Every `request.json()` occurrence must carry the catch, not just one.
      return /request\.json\(\)(?!\s*\.catch)/.test(src);
    });

    expect(
      offenders,
      "these public routes call request.json() without .catch(() => null), so a malformed body answers 5xx"
    ).toEqual([]);
  });
});
