import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface SupplierOrderPayload {
  orderId: string;
  orderNumber: string;
  items: {
    productId: string;
    productName: string;
    sku: string;
    supplierSku: string | null;
    quantity: number;
    unitPrice: number;
  }[];
  shippingAddress: {
    name: string;
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  customerEmail: string;
  customerNotes?: string;
}

export interface SupplierOrderResponse {
  success: boolean;
  supplierOrderId?: string;
  trackingNumber?: string;
  estimatedShipDate?: string;
  cost?: number;
  errorMessage?: string;
}

// Generic supplier API integration
export async function forwardOrderToSupplier(
  supplierId: string,
  supplierOrderId: string,
  payload: SupplierOrderPayload
): Promise<SupplierOrderResponse> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });

  if (!supplier) {
    return {
      success: false,
      errorMessage: "Supplier not found",
    };
  }

  if (!supplier.isActive) {
    return {
      success: false,
      errorMessage: "Supplier is inactive",
    };
  }

  if (!supplier.apiEndpoint) {
    // Mark as pending manual processing
    await prisma.supplierOrder.update({
      where: { id: supplierOrderId },
      data: {
        status: "pending_manual",
        notes: "No API configured - requires manual order placement",
      },
    });
    return {
      success: true,
      errorMessage: "No API configured - marked for manual processing",
    };
  }

  try {
    // Build request headers based on API type
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

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
          headers["X-API-Key"] = supplier.apiKey;
      }
    }

    // Map payload to supplier format
    // This is a generic implementation - specific supplier integrations
    // would need to customize the payload transformation
    const supplierPayload = {
      externalOrderId: payload.orderNumber,
      items: payload.items.map((item) => ({
        sku: item.supplierSku || item.sku,
        quantity: item.quantity,
        name: item.productName,
      })),
      shippingAddress: payload.shippingAddress,
      customerEmail: payload.customerEmail,
      notes: payload.customerNotes,
    };

    // Make API request
    const response = await fetch(`${supplier.apiEndpoint}/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(supplierPayload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Update supplier order with response
    await prisma.supplierOrder.update({
      where: { id: supplierOrderId },
      data: {
        status: "submitted",
        supplierOrderId: data.orderId || data.id || null,
        trackingNumber: data.trackingNumber || null,
        trackingUrl: data.trackingUrl || null,
        cost: data.cost ? new Prisma.Decimal(data.cost) : null,
        sentAt: new Date(),
      },
    });

    return {
      success: true,
      supplierOrderId: data.orderId || data.id,
      trackingNumber: data.trackingNumber,
      estimatedShipDate: data.estimatedShipDate,
      cost: data.cost,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    // Update supplier order with error
    await prisma.supplierOrder.update({
      where: { id: supplierOrderId },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    return {
      success: false,
      errorMessage,
    };
  }
}

// Sync order status from supplier
export async function syncOrderStatus(supplierOrderId: string): Promise<{
  success: boolean;
  status?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  errorMessage?: string;
}> {
  const supplierOrder = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    include: { supplier: true },
  });

  if (!supplierOrder) {
    return {
      success: false,
      errorMessage: "Supplier order not found",
    };
  }

  if (!supplierOrder.supplier.apiEndpoint || !supplierOrder.supplierOrderId) {
    return {
      success: false,
      errorMessage: "Cannot sync - no API or supplier order ID",
    };
  }

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (supplierOrder.supplier.apiKey) {
      switch (supplierOrder.supplier.apiType) {
        case "bearer":
          headers["Authorization"] = `Bearer ${supplierOrder.supplier.apiKey}`;
          break;
        case "api-key":
          headers["X-API-Key"] = supplierOrder.supplier.apiKey;
          break;
        case "basic":
          headers["Authorization"] = `Basic ${Buffer.from(supplierOrder.supplier.apiKey).toString(
            "base64"
          )}`;
          break;
        default:
          headers["X-API-Key"] = supplierOrder.supplier.apiKey;
      }
    }

    const response = await fetch(
      `${supplierOrder.supplier.apiEndpoint}/orders/${supplierOrder.supplierOrderId}`,
      {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Map supplier status to our status
    const statusMap: Record<string, string> = {
      pending: "pending",
      processing: "confirmed",
      shipped: "shipped",
      delivered: "delivered",
      cancelled: "cancelled",
    };

    const newStatus = statusMap[data.status?.toLowerCase()] || data.status;

    // Update supplier order
    await prisma.supplierOrder.update({
      where: { id: supplierOrderId },
      data: {
        status: newStatus,
        trackingNumber: data.trackingNumber || supplierOrder.trackingNumber,
        trackingUrl: data.trackingUrl || supplierOrder.trackingUrl,
      },
    });

    // If shipped, update the main order tracking info
    if (newStatus === "shipped" && data.trackingNumber) {
      await prisma.order.update({
        where: { id: supplierOrder.orderId },
        data: {
          trackingNumber: data.trackingNumber,
          trackingUrl: data.trackingUrl,
          status: "SHIPPED",
        },
      });
    }

    return {
      success: true,
      status: newStatus,
      trackingNumber: data.trackingNumber,
      trackingUrl: data.trackingUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      errorMessage,
    };
  }
}

// Create supplier orders from a main order
export async function createSupplierOrdersForOrder(orderId: string): Promise<string[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: {
              supplier: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // Group items by supplier
  const itemsBySupplier = new Map<
    string,
    { supplierId: string; supplierName: string; items: typeof order.items }
  >();

  for (const item of order.items) {
    const supplier = item.product.supplier;
    if (supplier) {
      const existing = itemsBySupplier.get(supplier.id);
      if (existing) {
        existing.items.push(item);
      } else {
        itemsBySupplier.set(supplier.id, {
          supplierId: supplier.id,
          supplierName: supplier.name,
          items: [item],
        });
      }
    }
  }

  // Create supplier orders
  const supplierOrderIds: string[] = [];

  for (const [supplierId, data] of itemsBySupplier) {
    // Check if supplier order already exists
    const existing = await prisma.supplierOrder.findFirst({
      where: {
        orderId,
        supplierId,
      },
    });

    if (existing) {
      supplierOrderIds.push(existing.id);
      continue;
    }

    // Calculate cost (sum of supplier prices)
    let totalCost = 0;
    for (const item of data.items) {
      if (item.product.supplierPrice) {
        totalCost += Number(item.product.supplierPrice) * item.quantity;
      }
    }

    const supplierOrder = await prisma.supplierOrder.create({
      data: {
        orderId,
        supplierId,
        status: "pending",
        cost: totalCost > 0 ? new Prisma.Decimal(totalCost) : null,
      },
    });

    supplierOrderIds.push(supplierOrder.id);
  }

  return supplierOrderIds;
}
