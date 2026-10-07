import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { supplierSchema } from "@/lib/validations";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/suppliers/[id] - Get a single supplier
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            supplierSku: true,
            price: true,
            supplierPrice: true,
            stock: true,
            isActive: true,
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        supplierOrders: {
          select: {
            id: true,
            orderId: true,
            supplierOrderId: true,
            status: true,
            trackingNumber: true,
            cost: true,
            createdAt: true,
            order: {
              select: {
                orderNumber: true,
              },
            },
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            products: true,
            supplierOrders: true,
          },
        },
      },
    });

    if (!supplier) {
      return apiError("Supplier not found", 404);
    }

    // Transform decimal fields for JSON serialization
    const transformedSupplier = {
      ...supplier,
      products: supplier.products.map((p) => ({
        ...p,
        price: p.price.toString(),
        supplierPrice: p.supplierPrice?.toString() || null,
      })),
      supplierOrders: supplier.supplierOrders.map((so) => ({
        ...so,
        cost: so.cost?.toString() || null,
      })),
    };

    return apiSuccess(transformedSupplier);
  } catch {
    return apiError("Failed to fetch supplier", 500);
  }
}

// PUT /api/admin/suppliers/[id] - Update a supplier
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = supplierSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const data = validationResult.data;

    // Check if supplier exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });
    if (!existingSupplier) {
      return apiError("Supplier not found", 404);
    }

    // Check if new code is unique (if changed)
    if (data.code !== existingSupplier.code) {
      const codeExists = await prisma.supplier.findUnique({
        where: { code: data.code.toUpperCase() },
      });
      if (codeExists) {
        return apiError("Supplier code already exists", 400);
      }
    }

    // Update supplier
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        email: data.email,
        phone: data.phone,
        website: data.website,
        apiEndpoint: data.apiEndpoint,
        apiKey: data.apiKey,
        apiType: data.apiType,
        isActive: data.isActive,
        notes: data.notes,
      },
      include: {
        _count: {
          select: {
            products: true,
            supplierOrders: true,
          },
        },
      },
    });

    return apiSuccess(supplier);
  } catch {
    return apiError("Failed to update supplier", 500);
  }
}

// DELETE /api/admin/suppliers/[id] - Delete a supplier
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    // Check if supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            supplierOrders: true,
          },
        },
      },
    });

    if (!supplier) {
      return apiError("Supplier not found", 404);
    }

    // Check if supplier has products
    if (supplier._count.products > 0) {
      return apiError(
        `Cannot delete supplier with ${supplier._count.products} linked products. Reassign or delete the products first.`,
        400
      );
    }

    // Check if supplier has orders
    if (supplier._count.supplierOrders > 0) {
      return apiError(
        `Cannot delete supplier with ${supplier._count.supplierOrders} orders. This supplier has historical order data.`,
        400
      );
    }

    // Delete supplier
    await prisma.supplier.delete({ where: { id } });

    return apiSuccess({ message: "Supplier deleted successfully" });
  } catch {
    return apiError("Failed to delete supplier", 500);
  }
}
