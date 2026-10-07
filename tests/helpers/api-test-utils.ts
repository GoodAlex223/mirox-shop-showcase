import { NextRequest } from "next/server";

/**
 * Create a NextRequest for testing API route handlers.
 */
export function createNextRequest(options: {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  /**
   * Body sent verbatim, bypassing `JSON.stringify` — the only way to hand a
   * handler something `request.json()` cannot parse. `body` covers the happy
   * path; this covers the malformed-payload contract (G20). Passing both is a
   * test bug, so it throws rather than silently picking one.
   */
  rawBody?: string;
  searchParams?: Record<string, string>;
}): NextRequest {
  const { url, method = "GET", body, rawBody, searchParams } = options;

  if (body !== undefined && rawBody !== undefined) {
    throw new Error("createNextRequest: pass either `body` or `rawBody`, not both");
  }

  const fullUrl = new URL(url, "http://localhost:3000");
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      fullUrl.searchParams.set(key, value);
    });
  }

  const payload =
    rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;

  return new NextRequest(fullUrl, {
    method,
    ...(payload !== undefined && {
      body: payload,
      headers: { "Content-Type": "application/json" },
    }),
  });
}

/**
 * Create route params for Next.js 14 dynamic segments.
 * Next.js 14 passes params as Promise<{ id: string }>.
 */
export function createRouteParams<T extends Record<string, string>>(
  params: T
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}
