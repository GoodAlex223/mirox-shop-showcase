import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { categorySchema } from "@/lib/validations";
import {
  requireAdmin,
  apiError,
  apiSuccess,
  getPagination,
  paginatedResponse,
} from "@/lib/api-utils";
import { slugFromInput } from "@/lib/slug";
import { Prisma } from "@prisma/client";

// GET /api/admin/categories - List categories
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const all = searchParams.get("all") === "true";

    // If all=true, return all categories for dropdowns
    if (all) {
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, parentId: true },
        orderBy: { name: "asc" },
      });
      return apiSuccess(categories);
    }

    const { page, limit, skip } = getPagination(searchParams);
    const search = searchParams.get("search") || "";
    const parentId = searchParams.get("parentId");
    const isActive = searchParams.get("isActive");

    // Build where clause
    const where: Prisma.CategoryWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    if (parentId === "null") {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId;
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { products: true, children: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip,
        take: limit,
      }),
      prisma.category.count({ where }),
    ]);

    return apiSuccess(paginatedResponse(categories, total, { page, limit, skip }));
  } catch {
    return apiError("Failed to fetch categories", 500);
  }
}

// POST /api/admin/categories - Create category
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();

    // Validate input
    const validationResult = categorySchema.safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400, "VALIDATION_ERROR");
    }

    const data = validationResult.data;

    // G24: the typed slug when there is one, else the name — normalized either
    // way (Ukrainian → Latin). An empty result is rejected, never stored.
    let slug = slugFromInput(data.slug, data.name);
    if (!slug) {
      return apiError("Slug must contain a letter or digit", 400, "SLUG_EMPTY");
    }
    const existingSlug = await prisma.category.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Verify parent exists if provided
    if (data.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) {
        return apiError("Parent category not found", 400, "PARENT_NOT_FOUND");
      }
    }

    // Create category
    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        image: data.image,
        parentId: data.parentId,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: true, children: true } },
      },
    });

    return apiSuccess(category, 201);
  } catch {
    return apiError("Failed to create category", 500, "CREATE_FAILED");
  }
}
