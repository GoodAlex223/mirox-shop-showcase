import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, apiError, apiSuccess } from "@/lib/api-utils";
import { generateSlug } from "@/lib/slug";
import Papa from "papaparse";
import { toCsv } from "@/lib/csv";

interface CSVRow {
  name: string;
  description?: string;
  shortDesc?: string;
  price: string;
  comparePrice?: string;
  costPrice?: string;
  sku: string;
  barcode?: string;
  brand?: string;
  mpn?: string;
  stock?: string;
  category?: string;
  categoryId?: string;
  isActive?: string;
  isFeatured?: string;
  imageUrl?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; sku: string; error: string }[];
}

// POST /api/admin/products/import - Import products from CSV
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const updateExisting = formData.get("updateExisting") === "true";

    if (!file) {
      return apiError("No file provided", 400);
    }

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      return apiError("File must be a CSV", 400);
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const { data, errors: parseErrors } = Papa.parse<CSVRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, ""),
    });

    if (parseErrors.length > 0) {
      return apiError(`CSV parsing error: ${parseErrors[0].message}`, 400);
    }

    if (data.length === 0) {
      return apiError("CSV file is empty", 400);
    }

    // Get all categories for mapping
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, slug: true },
    });

    const categoryMap = new Map<string, string>();
    categories.forEach((cat) => {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
      categoryMap.set(cat.slug.toLowerCase(), cat.id);
      categoryMap.set(cat.id, cat.id);
    });

    // Default category if none specified
    const defaultCategoryId = categories[0]?.id;

    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 because of header and 0-index

      try {
        // Validate required fields
        if (!row.name?.trim()) {
          throw new Error("Name is required");
        }
        if (!row.sku?.trim()) {
          throw new Error("SKU is required");
        }
        if (!row.price?.trim() || isNaN(parseFloat(row.price))) {
          throw new Error("Valid price is required");
        }

        const sku = row.sku.trim();
        const name = row.name.trim();
        const price = parseFloat(row.price);

        // Find category
        let categoryId = defaultCategoryId;
        if (row.categoryId?.trim()) {
          categoryId = categoryMap.get(row.categoryId.trim().toLowerCase()) || defaultCategoryId;
        } else if (row.category?.trim()) {
          categoryId = categoryMap.get(row.category.trim().toLowerCase()) || defaultCategoryId;
        }

        if (!categoryId) {
          throw new Error("No valid category found and no default category available");
        }

        // Check if product exists
        const existingProduct = await prisma.product.findUnique({
          where: { sku },
        });

        if (existingProduct) {
          if (updateExisting) {
            // Update existing product
            await prisma.product.update({
              where: { sku },
              data: {
                name,
                description: row.description?.trim() || undefined,
                shortDesc: row.shortDesc?.trim() || undefined,
                price,
                comparePrice: row.comparePrice ? parseFloat(row.comparePrice) : undefined,
                costPrice: row.costPrice ? parseFloat(row.costPrice) : undefined,
                barcode: row.barcode?.trim() || undefined,
                brand: row.brand?.trim() || undefined,
                mpn: row.mpn?.trim() || undefined,
                stock: row.stock ? parseInt(row.stock) : undefined,
                categoryId,
                isActive: row.isActive ? row.isActive.toLowerCase() === "true" : undefined,
                isFeatured: row.isFeatured ? row.isFeatured.toLowerCase() === "true" : undefined,
              },
            });
            result.success++;
          } else {
            throw new Error("SKU already exists (enable 'Update existing' to update)");
          }
        } else {
          // Create new product
          const slug = generateSlug(name);
          let uniqueSlug = slug;

          // Ensure slug is unique
          const existingSlug = await prisma.product.findUnique({ where: { slug } });
          if (existingSlug) {
            uniqueSlug = `${slug}-${Date.now().toString(36)}`;
          }

          const product = await prisma.product.create({
            data: {
              name,
              slug: uniqueSlug,
              description: row.description?.trim() || null,
              shortDesc: row.shortDesc?.trim() || null,
              price,
              comparePrice: row.comparePrice ? parseFloat(row.comparePrice) : null,
              costPrice: row.costPrice ? parseFloat(row.costPrice) : null,
              sku,
              barcode: row.barcode?.trim() || null,
              brand: row.brand?.trim() || null,
              mpn: row.mpn?.trim() || null,
              stock: row.stock ? parseInt(row.stock) : 0,
              categoryId,
              isActive: row.isActive ? row.isActive.toLowerCase() === "true" : true,
              isFeatured: row.isFeatured ? row.isFeatured.toLowerCase() === "true" : false,
            },
          });

          // Add image if provided
          if (row.imageUrl?.trim()) {
            await prisma.productImage.create({
              data: {
                productId: product.id,
                url: row.imageUrl.trim(),
                position: 0,
              },
            });
          }

          result.success++;
        }
      } catch (err) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          sku: row.sku || "N/A",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return apiSuccess({
      message: `Import complete: ${result.success} succeeded, ${result.failed} failed`,
      ...result,
    });
  } catch {
    return apiError("Failed to import products", 500);
  }
}

// GET /api/admin/products/import - Get CSV template
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  // Static, developer-authored content — no injection surface today. It goes
  // through the shared sink anyway (PR #43 review finding 6): this is a CSV
  // emitter, and the one exemption is the crack the next hand-rolled export
  // grows from. If the template ever becomes data-driven it is already safe.
  const template = toCsv([
    [
      "name",
      "sku",
      "price",
      "comparePrice",
      "costPrice",
      "stock",
      "category",
      "brand",
      "barcode",
      "mpn",
      "description",
      "shortDesc",
      "isActive",
      "isFeatured",
      "imageUrl",
    ],
    [
      "Example Product",
      "SKU-001",
      "29.99",
      "39.99",
      "15.00",
      "100",
      "Electronics",
      "BrandName",
      "0123456789012",
      "MPN-001",
      "Full product description here",
      "Short description",
      "true",
      "false",
      "https://example.com/image.jpg",
    ],
  ]);

  return new Response(template, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="product-import-template.csv"',
    },
  });
}
