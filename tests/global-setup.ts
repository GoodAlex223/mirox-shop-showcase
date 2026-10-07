import { PrismaClient } from "@prisma/client";

export default async function globalSetup() {
  console.log("Playwright Global Setup: Validating test infrastructure...");

  const prisma = new PrismaClient();

  try {
    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log("  Database connection: OK");

    // Verify seed data exists
    const [categoryCount, productCount] = await Promise.all([
      prisma.category.count(),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    console.log(`  Categories: ${categoryCount}, Active products: ${productCount}`);

    if (categoryCount === 0) {
      throw new Error("No categories found in database. Run: npx prisma db seed");
    }

    if (productCount === 0) {
      throw new Error("No active products found in database. Run: npx prisma db seed");
    }

    console.log("Global setup complete - infrastructure validated\n");
  } catch (error) {
    console.error("Global setup failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
