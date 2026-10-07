import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/stripe";
import { getDeliveryMethod, getPickupKind } from "@/lib/shipping";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { setOrderGrantCookie } from "@/lib/order-access";
import { checkoutSchema } from "@/lib/validations";
import { InsufficientStockError, INSUFFICIENT_STOCK_RESPONSE } from "@/lib/checkout-errors";
import { z } from "zod";

// No-prepayment COD order creation (spec §4). Guest-capable: session optional.
// The dormant Stripe path (create-payment-intent + confirm-order) is untouched.
const createOrderSchema = checkoutSchema
  .extend({
    items: z
      .array(
        z.object({
          productId: z.string(),
          variantId: z.string().optional(),
          // Capped: an uncapped quantity was a free arbitrary-stock-negative
          // primitive on an unauthenticated COD route (PR #29 r6). 100 per line
          // is far above any legitimate order; the stock-sufficiency guard
          // (gte) below rejects an oversell outright (G17 F8).
          quantity: z.number().int().positive().max(100),
        })
      )
      .min(1),
  })
  // G25 (spec §5.5): a warehouse ref needs its city ref and a pickup method.
  // Applied AFTER .extend(): Zod 4 throws on .extend() of a refined object, so
  // checkoutSchema itself stays unrefined. An order without refs is valid —
  // that is the manual fallback. No NP call here; refs are not re-verified.
  .superRefine((data, ctx) => {
    const { npCityRef, npWarehouseRef } = data.shippingAddress;
    if (!npWarehouseRef) return;
    if (!npCityRef) {
      ctx.addIssue({
        code: "custom",
        path: ["shippingAddress", "npCityRef"],
        message: "npWarehouseRef requires npCityRef",
      });
    }
    if (!getPickupKind(data.shippingMethod)) {
      ctx.addIssue({
        code: "custom",
        path: ["shippingAddress", "npWarehouseRef"],
        message: "npWarehouseRef is only valid for np-office and np-postomat",
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json().catch(() => null);
    const data = createOrderSchema.parse(body);

    const deliveryMethod = getDeliveryMethod(data.shippingMethod);
    if (!deliveryMethod) {
      // `error` strings are for logs/API consumers; the client maps `code` to
      // localized copy (PR #29 r4 — the UA fallback was otherwise unreachable).
      return NextResponse.json(
        { error: "Invalid shipping method", code: "INVALID_SHIPPING_METHOD" },
        { status: 400 }
      );
    }

    const productIds = data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { variants: true },
    });

    // Prices always come from the DB — the client payload is never trusted.
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
      // Missing OR deactivated (filtered by the isActive gate above): reject the
      // whole order instead of silently skipping the line — a skip would alter
      // the total the customer approved, and deactivation is routine, not rare
      // (PR #29 r4; supersedes the spec §4 silent-skip parity).
      if (!product) {
        return NextResponse.json(
          { error: "Ordered product is unavailable", code: "PRODUCT_UNAVAILABLE" },
          { status: 400 }
        );
      }

      let price = Number(product.price);
      let variantInfo: string | undefined;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        // A variantId that doesn't resolve within its product is either a stale
        // cart line or a forged id targeting another product's stock — reject
        // rather than drop, so a size line never silently disappears (PR #29 r3).
        if (!variant) {
          return NextResponse.json(
            { error: "Invalid variant for ordered product", code: "INVALID_VARIANT" },
            { status: 400 }
          );
        }
        if (variant.price) price = Number(variant.price);
        variantInfo = `${variant.name}: ${variant.value}`;
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

    const shippingCost = deliveryMethod.price;
    const tax = 0;
    const total = subtotal + shippingCost + tax;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: session?.user?.id || null,
          email: data.email,
          phone: data.shippingAddress.phone,
          status: "PENDING",
          subtotal,
          shippingCost,
          tax,
          total,
          shippingAddress: data.shippingAddress,
          shippingMethod: data.shippingMethod,
          paymentMethod: "cod",
          paymentStatus: "PENDING",
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
        include: { items: true },
      });

      // Decrement from the filtered order lines, never the raw client items —
      // products dropped by the isActive/existence gate must not lose stock
      // (and a hard-deleted product no longer P2025s the transaction).
      //
      // updateMany + `stock: { gte }` makes the check and the decrement one
      // atomic statement: the row is only written if it still holds enough
      // stock, so two concurrent orders cannot both pass a separate read. A
      // count of 0 means the guard rejected it — throw to roll the whole
      // transaction back, order row included (G17 F8). Before this, an
      // unauthenticated caller could loop the route and drive every product's
      // stock negative, emptying the storefront.
      for (const item of orderItemsData) {
        const { count } = item.variantId
          ? await tx.productVariant.updateMany({
              where: { id: item.variantId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            })
          : await tx.product.updateMany({
              where: { id: item.productId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });

        if (count === 0) throw new InsufficientStockError(item.productName);
      }

      return newOrder;
    });

    // Awaited deliberately: an unawaited fire-and-forget dies when the
    // serverless function freezes after the response returns — the send never
    // executed in prod (found 2026-08-10, the first day a live RESEND_API_KEY
    // existed there). Failure stays non-critical via the catch.
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

    // The post-checkout one-time grant (G18 spec §1): the browser stores this
    // same-origin fetch response's cookie before router.push navigates, so the
    // confirmation page can authorize the just-created order with no user
    // action. Cold visits later re-verify via /track.
    const response = NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
    setOrderGrantCookie(response, order.orderNumber, request);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid order data", code: "INVALID_ORDER_DATA", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof InsufficientStockError) {
      return NextResponse.json(INSUFFICIENT_STOCK_RESPONSE.body, {
        status: INSUFFICIENT_STOCK_RESPONSE.status,
      });
    }

    return NextResponse.json(
      { error: "Failed to create order", code: "ORDER_CREATE_FAILED" },
      { status: 500 }
    );
  }
}
