import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }

  if (session.user.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session };
}

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }

  return { error: null, session };
}

export function apiError(message: string, status: number = 400, code?: string) {
  // `code` is machine-readable for clients that map outcomes to localized
  // copy (see the newsletter routes); `message` stays log/consumer text.
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export function getPagination(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  { page, limit }: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
