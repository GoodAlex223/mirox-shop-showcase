import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/products/[slug] - Get single product by slug
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const product = await prisma.product.findFirst({
      where: {
        slug,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        shortDesc: true,
        price: true,
        comparePrice: true,
        stock: true,
        sku: true,
        isFeatured: true,
        metaTitle: true,
        metaDesc: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          select: { id: true, url: true, alt: true, position: true },
          orderBy: { position: "asc" },
        },
        variants: {
          select: {
            id: true,
            name: true,
            value: true,
            price: true,
            stock: true,
            sku: true,
          },
          orderBy: { createdAt: "asc" },
        },
        createdAt: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Get related products from same category
    const relatedProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        categoryId: product.category.id,
        id: { not: product.id },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        comparePrice: true,
        images: {
          select: { url: true, alt: true },
          orderBy: { position: "asc" },
          take: 1,
        },
      },
      take: 4,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ...product,
      relatedProducts,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
