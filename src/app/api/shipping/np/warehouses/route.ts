import { NextRequest, NextResponse } from "next/server";
import {
  cachedSearchWarehouses,
  NovaPoshtaError,
  NovaPoshtaRateLimitError,
} from "@/lib/nova-poshta";
import { npWarehousesQuerySchema } from "@/lib/validations/nova-poshta";

// Public Nova Poshta pickup-point search for the checkout picker (G25):
// branches (Branch/DropOff/Store) or postomats of one city. Same posture and
// the same `fetchCache` warning as the cities route.

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = npWarehousesQuerySchema.safeParse({
    city: params.get("city") ?? "",
    kind: params.get("kind") ?? "",
    q: params.get("q") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pickup-point search", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  try {
    const { city, kind, q } = parsed.data;
    return NextResponse.json(await cachedSearchWarehouses(city, kind, q));
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
      { error: "Pickup-point search failed", code: "SEARCH_FAILED" },
      { status: 500 }
    );
  }
}
