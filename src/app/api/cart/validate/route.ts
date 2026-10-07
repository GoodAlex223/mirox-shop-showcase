import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/cart/validate - Validate stock for a cart item
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get("productId");
    const variantId = searchParams.get("variantId");

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // If variant is specified, check variant stock
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: {
          id: true,
          stock: true,
          product: {
            select: { isActive: true },
          },
        },
      });

      if (!variant) {
        return NextResponse.json({
          stock: 0,
          isAvailable: false,
          message: "Variant not found",
        });
      }

      return NextResponse.json({
        stock: variant.stock,
        isAvailable: variant.product.isActive && variant.stock > 0,
      });
    }

    // Check product stock
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        stock: true,
        isActive: true,
      },
    });

    if (!product) {
      return NextResponse.json({
        stock: 0,
        isAvailable: false,
        message: "Product not found",
      });
    }

    return NextResponse.json({
      stock: product.stock,
      isAvailable: product.isActive && product.stock > 0,
    });
  } catch {
    return NextResponse.json({ error: "Failed to validate cart item" }, { status: 500 });
  }
}
