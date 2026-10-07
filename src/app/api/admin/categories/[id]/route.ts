import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { categorySchema } from "@/lib/validations";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { generateSlug, nonBlankSlug } from "@/lib/slug";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/categories/[id] - Get single category
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          select: { id: true, name: true, slug: true, isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { products: true, children: true } },
      },
    });

    if (!category) {
      return apiError("Category not found", 404);
    }

    return apiSuccess(category);
  } catch {
    return apiError("Failed to fetch category", 500);
  }
}

// PUT /api/admin/categories/[id] - Update category
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if category exists
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return apiError("Category not found", 404, "CATEGORY_NOT_FOUND");
    }

    // Validate input
    const validationResult = categorySchema.partial().safeParse(body);
    if (!validationResult.success) {
      return apiError(validationResult.error.issues[0].message, 400, "VALIDATION_ERROR");
    }

    const data = validationResult.data;

    // G24 slug rule (as in api/admin/products/[id]). A slug sent back as stored
    // is kept byte for byte — never re-normalized, so no live URL moves. A
    // different typed slug is normalized and must be free. With the field blank,
    // a rename regenerates it from the new name. An empty result is rejected,
    // never stored.
    const typedSlug = nonBlankSlug(data.slug);
    let slug = existing.slug;
    if (typedSlug !== undefined && typedSlug !== existing.slug) {
      const normalized = generateSlug(typedSlug);
      if (!normalized) {
        return apiError("Slug must contain a letter or digit", 400, "SLUG_EMPTY");
      }
      if (normalized !== existing.slug) {
        const existingSlug = await prisma.category.findUnique({ where: { slug: normalized } });
        if (existingSlug && existingSlug.id !== id) {
          return apiError("Slug already in use", 400, "SLUG_TAKEN");
        }
      }
      slug = normalized;
    } else if (typedSlug === undefined && data.name && data.name !== existing.name) {
      // Auto-generate new slug if name changed and no explicit slug provided
      const newSlug = generateSlug(data.name);
      if (!newSlug) {
        return apiError("Slug must contain a letter or digit", 400, "SLUG_EMPTY");
      }
      const existingSlug = await prisma.category.findUnique({ where: { slug: newSlug } });
      if (!existingSlug || existingSlug.id === id) {
        slug = newSlug;
      }
    }

    // Prevent circular parent reference
    if (data.parentId) {
      if (data.parentId === id) {
        return apiError("Category cannot be its own parent", 400, "SELF_PARENT");
      }

      // Check if parent exists
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) {
        return apiError("Parent category not found", 400, "PARENT_NOT_FOUND");
      }

      // Check if parent would create a circular reference
      let currentParent = parent;
      while (currentParent.parentId) {
        if (currentParent.parentId === id) {
          return apiError("Circular parent reference detected", 400, "CIRCULAR_PARENT");
        }
        currentParent = (await prisma.category.findUnique({
          where: { id: currentParent.parentId },
        })) as typeof currentParent;
        if (!currentParent) break;
      }
    }

    // Update category
    const category = await prisma.category.update({
      where: { id },
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

    return apiSuccess(category);
  } catch {
    return apiError("Failed to update category", 500, "UPDATE_FAILED");
  }
}

// DELETE /api/admin/categories/[id] - Delete category
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, children: true } },
      },
    });

    if (!category) {
      return apiError("Category not found", 404);
    }

    // Check if category has products
    if (category._count.products > 0) {
      return apiError(
        `Cannot delete category with ${category._count.products} products. Move or delete the products first.`,
        400
      );
    }

    // Check if category has children
    if (category._count.children > 0) {
      return apiError(
        `Cannot delete category with ${category._count.children} subcategories. Delete or reassign them first.`,
        400
      );
    }

    // Delete the category
    await prisma.category.delete({ where: { id } });

    return apiSuccess({ message: "Category deleted successfully" });
  } catch {
    return apiError("Failed to delete category", 500);
  }
}
