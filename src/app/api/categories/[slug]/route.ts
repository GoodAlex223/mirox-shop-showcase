import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/categories/[slug] - Get single category by slug
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const category = await prisma.category.findFirst({
      where: {
        slug,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            image: true,
            _count: {
              select: { products: { where: { isActive: true } } },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 });
  }
}
