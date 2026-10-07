import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/products/brands — distinct brands for the catalog filter
export async function GET() {
  try {
    const rows = await prisma.product.findMany({
      where: { isActive: true, brand: { not: null } },
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    });
    return NextResponse.json(rows.map((row) => row.brand));
  } catch {
    return NextResponse.json({ error: "Failed to fetch brands" }, { status: 500 });
  }
}
