import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripe, getShippingMethod, generateOrderNumber } from "@/lib/stripe";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { z } from "zod";
import { InsufficientStockError, INSUFFICIENT_STOCK_RESPONSE } from "@/lib/checkout-errors";

const confirmOrderSchema = z.object({
  paymentIntentId: z.string(),
  email: z.string().email(),
  shippingAddress: z.object({
    name: z.string(),
    company: z.string().optional(),
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }),
  shippingMethod: z.string(),
  customerNotes: z.string().optional(),
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
    const data = confirmOrderSchema.parse(body);

    // Verify payment intent is successful
    const paymentIntent = await getStripe().paymentIntents.retrieve(data.paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    // Check if order already exists for this payment intent
    const existingOrder = await prisma.order.findFirst({
      where: { paymentIntent: data.paymentIntentId },
    });

    if (existingOrder) {
      return NextResponse.json({
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        message: "Order already exists",
      });
    }

    // Validate products and get current data
    const productIds = data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });

    // Calculate totals and prepare order items
    let subtotal = 0;
    const orderItemsData: Array<{
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
      if (!product) continue;

      let price = Number(product.price);
      let variantInfo: string | undefined;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (variant) {
          if (variant.price) price = Number(variant.price);
          variantInfo = `${variant.name}: ${variant.value}`;
        }
      }

      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
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

    const shippingMethod = getShippingMethod(data.shippingMethod);
    const shippingCost = shippingMethod?.price ?? 0;
    const tax = 0;
    const total = subtotal + shippingCost + tax;

    // The intent id AND the item list both arrive from the client, and this
    // route is unauthenticated. Without comparing what was actually paid to
    // what the server priced, one cheap succeeded intent could be replayed
    // against a cart of the most expensive goods and stored PAID (G17 F7).
    //
    // Minor units, matching create-payment-intent's `Math.round(total * 100)`.
    // The currency is still test-mode "usd" against UAH amounts — a documented,
    // deliberate mismatch until TASK-048, so it is asserted rather than
    // converted; a differing currency means the intent is not this cart's.
    const expectedMinorUnits = Math.round(total * 100);
    const paidMinorUnits = paymentIntent.amount_received ?? 0;

    if (paymentIntent.currency !== "usd" || paidMinorUnits < expectedMinorUnits) {
      return NextResponse.json(
        { error: "Payment does not cover the order total", code: "PAYMENT_AMOUNT_MISMATCH" },
        { status: 400 }
      );
    }

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber: paymentIntent.metadata.orderNumber || generateOrderNumber(),
          userId: session?.user?.id || null,
          email: data.email,
          phone: data.shippingAddress.phone,
          status: "CONFIRMED",
          subtotal,
          shippingCost,
          tax,
          total,
          shippingAddress: data.shippingAddress,
          shippingMethod: data.shippingMethod,
          paymentMethod: "card",
          paymentIntent: data.paymentIntentId,
          paymentStatus: "PAID",
          paidAt: new Date(),
          customerNotes: data.customerNotes,
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              productSku: item.productSku,
              variantInfo: item.variantInfo,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Decrement from the filtered order lines, not the raw client items —
      // same rule create-order follows: an item dropped by the existence gate
      // above was never priced into the order and must not move stock.
      for (const item of orderItemsData) {
        if (item.variantId) {
          const { count } = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (count === 0) throw new InsufficientStockError(item.productName);
        } else {
          const { count } = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (count === 0) throw new InsufficientStockError(item.productName);
        }
      }

      return newOrder;
    });

    // Awaited deliberately: an unawaited fire-and-forget dies when the
    // serverless function freezes after the response returns (same fix as
    // create-order, 2026-08-10). Failure stays non-critical via the catch.
    await sendOrderConfirmationEmail({
      orderNumber: order.orderNumber,
      email: data.email,
      items: orderItemsData.map((item) => ({
        productName: item.productName,
        variantInfo: item.variantInfo,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      subtotal,
      shippingCost,
      tax,
      total,
      shippingAddress: data.shippingAddress,
      shippingMethod: data.shippingMethod,
      hasAccount: Boolean(session?.user?.id),
    }).catch(() => {
      // Email failure is non-critical — order is already created
    });

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      message: "Order created successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid order data", details: error.issues },
        { status: 400 }
      );
    }

    // Same coded outcome as create-order: a client must be able to tell a
    // sold-out line from a server fault, and both routes share the sink.
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(INSUFFICIENT_STOCK_RESPONSE.body, {
        status: INSUFFICIENT_STOCK_RESPONSE.status,
      });
    }

    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
