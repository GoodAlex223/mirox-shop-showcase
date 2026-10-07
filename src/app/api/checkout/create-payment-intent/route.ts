import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripe, calculateOrderTotals, generateOrderNumber } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validations";
import { z } from "zod";

const paymentIntentSchema = checkoutSchema.extend({
  items: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string().optional(),
      quantity: z.number().int().positive(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json().catch(() => null);
    const data = paymentIntentSchema.parse(body);

    // Validate cart items and get current prices
    const productIds = data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
      include: {
        variants: true,
      },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Some products are no longer available" }, { status: 400 });
    }

    // Calculate order items with current prices
    let subtotal = 0;
    const orderItems: Array<{
      productId: string;
      variantId?: string;
      productName: string;
      productSku: string;
      variantInfo?: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    for (const item of data.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 }
        );
      }

      let price = Number(product.price);
      let variantInfo: string | undefined;
      let availableStock = product.stock;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          return NextResponse.json(
            { error: `Variant not found: ${item.variantId}` },
            { status: 400 }
          );
        }
        if (variant.price) {
          price = Number(variant.price);
        }
        variantInfo = `${variant.name}: ${variant.value}`;
        availableStock = variant.stock;
      }

      // Check stock
      if (item.quantity > availableStock) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        );
      }

      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product.id,
        variantId: item.variantId,
        productName: product.name,
        productSku: product.sku,
        variantInfo,
        quantity: item.quantity,
        unitPrice: price,
        totalPrice: itemTotal,
      });
    }

    // Calculate totals
    const totals = calculateOrderTotals(subtotal, data.shippingMethod);

    // Create Stripe Payment Intent
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: Math.round(totals.total * 100), // Convert to cents
      currency: "usd",
      metadata: {
        email: data.email,
        orderNumber: generateOrderNumber(),
        userId: session?.user?.id || "",
      },
    });

    // Store pending order data in metadata for webhook processing
    // In production, consider using a database session or Redis

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderNumber: paymentIntent.metadata.orderNumber,
      totals,
      items: orderItems,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid checkout data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 });
  }
}
