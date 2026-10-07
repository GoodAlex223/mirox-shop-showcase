import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/categories - Public category listing
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const withProducts = searchParams.get("withProducts") === "true";
    const parentOnly = searchParams.get("parentOnly") === "true";

    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        ...(parentOnly && { parentId: null }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        parentId: true,
        sortOrder: true,
        ...(withProducts && {
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
            },
          },
        }),
        children: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            sortOrder: true,
            _count: {
              select: {
                products: {
                  where: { isActive: true },
                },
              },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(categories);
  } catch {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
