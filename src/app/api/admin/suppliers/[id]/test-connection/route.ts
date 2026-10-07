import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/suppliers/[id]/test-connection - Test supplier API connection
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      return apiError("Supplier not found", 404);
    }

    if (!supplier.apiEndpoint) {
      return apiError("Supplier has no API endpoint configured", 400);
    }

    // Test the API connection based on apiType
    const startTime = Date.now();
    let success = false;
    let message = "";
    let responseData: Record<string, unknown> | null = null;

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      // Add API key based on common patterns
      if (supplier.apiKey) {
        switch (supplier.apiType) {
          case "bearer":
            headers["Authorization"] = `Bearer ${supplier.apiKey}`;
            break;
          case "api-key":
            headers["X-API-Key"] = supplier.apiKey;
            break;
          case "basic":
            headers["Authorization"] = `Basic ${Buffer.from(supplier.apiKey).toString("base64")}`;
            break;
          default:
            // Default to API key header
            headers["X-API-Key"] = supplier.apiKey;
        }
      }

      // Make test request (GET to base endpoint)
      const response = await fetch(supplier.apiEndpoint, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        success = true;
        message = `Connection successful (${responseTime}ms)`;
        try {
          const data = await response.json();
          responseData = {
            status: response.status,
            statusText: response.statusText,
            responseTime,
            sample: JSON.stringify(data).slice(0, 500),
          };
        } catch {
          responseData = {
            status: response.status,
            statusText: response.statusText,
            responseTime,
            contentType: response.headers.get("content-type"),
          };
        }
      } else {
        success = false;
        message = `API returned error: ${response.status} ${response.statusText}`;
        responseData = {
          status: response.status,
          statusText: response.statusText,
          responseTime,
        };
      }
    } catch (fetchError) {
      const responseTime = Date.now() - startTime;
      success = false;
      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          message = "Connection timed out after 10 seconds";
        } else {
          message = `Connection failed: ${fetchError.message}`;
        }
      } else {
        message = "Connection failed: Unknown error";
      }
      responseData = {
        responseTime,
        error: message,
      };
    }

    return apiSuccess({
      success,
      message,
      data: responseData,
    });
  } catch {
    return apiError("Failed to test connection", 500);
  }
}
