import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { supplierSchema } from "@/lib/validations";
import {
  requireAdmin,
  apiError,
  apiSuccess,
  getPagination,
  paginatedResponse,
} from "@/lib/api-utils";
import { Prisma } from "@prisma/client";

// GET /api/admin/suppliers - List suppliers with pagination, search, and filters
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPagination(searchParams);

    // Filters
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("isActive");
    const hasApi = searchParams.get("hasApi");
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    // Build where clause
    const where: Prisma.SupplierWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (isActive !== null && isActive !== undefined && isActive !== "all") {
      where.isActive = isActive === "true";
    }

    if (hasApi === "true") {
      where.apiEndpoint = { not: null };
    } else if (hasApi === "false") {
      where.apiEndpoint = null;
    }

    // Build order by
    const orderBy: Prisma.SupplierOrderByWithRelationInput = {};
    if (["name", "code", "createdAt", "updatedAt"].includes(sortBy)) {
      orderBy[sortBy as keyof Prisma.SupplierOrderByWithRelationInput] =
        sortOrder === "asc" ? "asc" : "desc";
    }

    // Execute queries
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: {
              products: true,
              supplierOrders: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    // Transform to hide sensitive API keys in list view
    const transformedSuppliers = suppliers.map((supplier) => ({
      ...supplier,
      apiKey: supplier.apiKey ? "••••••••" : null,
    }));

    return apiSuccess(paginatedResponse(transformedSuppliers, total, { page, limit, skip }));
  } catch {
    return apiError("Failed to fetch suppliers", 500);
  }
}

// POST /api/admin/suppliers - Create a new supplier
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();

    // Validate input
    const validationResult = supplierSchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400);
    }

    const data = validationResult.data;

    // Check if code is unique
    const existingCode = await prisma.supplier.findUnique({
      where: { code: data.code },
    });
    if (existingCode) {
      return apiError("Supplier code already exists", 400);
    }

    // Create supplier
    const supplier = await prisma.supplier.create({
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

    return apiSuccess(supplier, 201);
  } catch {
    return apiError("Failed to create supplier", 500);
  }
}
