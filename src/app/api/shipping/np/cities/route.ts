import { NextRequest, NextResponse } from "next/server";
import { cachedSearchCities, NovaPoshtaError, NovaPoshtaRateLimitError } from "@/lib/nova-poshta";
import { npCitiesQuerySchema } from "@/lib/validations/nova-poshta";

// Public Nova Poshta city search for the checkout picker (G25). No auth: the
// response is NP directory data, and the key stays inside src/lib/nova-poshta.ts.
// Do NOT add a `fetchCache` segment config — "force-no-store" makes
// unstable_cache skip its cache entirely (spec §5.3).

export async function GET(request: NextRequest) {
  const parsed = npCitiesQuerySchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid city search", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const items = await cachedSearchCities(parsed.data.q);
    return NextResponse.json({ items });
  } catch (error) {
    // The subclass first: NP throttled us, so the browser should pause and retry.
    if (error instanceof NovaPoshtaRateLimitError) {
      return NextResponse.json(
        { error: "Nova Poshta is busy", code: "NP_BUSY", retryAfterMs: error.retryAfterMs },
        { status: 503, headers: { "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)) } }
      );
    }
    if (error instanceof NovaPoshtaError) {
      return NextResponse.json(
        { error: "Nova Poshta is unavailable", code: "NP_UNAVAILABLE" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "City search failed", code: "SEARCH_FAILED" },
      { status: 500 }
    );
  }
}
