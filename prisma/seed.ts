import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient, Role, OrderStatus, PaymentStatus, SubscriberStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { adminUser, resolveSeedPassword, testCustomers } from "./seed-data/users";
import { topLevelCategories, subcategories } from "./seed-data/categories";
import { products } from "./seed-data/products";
import { orders } from "./seed-data/orders";
import { reviews } from "./seed-data/reviews";
import { subscribers } from "./seed-data/subscribers";

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "postgres", "db"]);

function databaseHost(): string {
  const raw = process.env.DATABASE_URL ?? "";
  try {
    return new URL(raw).hostname;
  } catch {
    throw new Error("DATABASE_URL is missing or unparsable — refusing to seed.");
  }
}

function isLocalDatabaseHost(): boolean {
  return LOCAL_DB_HOSTS.has(databaseHost());
}

function assertLocalDatabase() {
  const host = databaseHost();
  const local = LOCAL_DB_HOSTS;
  if (!local.has(host) && process.env.SEED_ALLOW_REMOTE !== "1") {
    throw new Error(
      `Refusing to seed non-local database host "${host}". ` +
        `This seed DELETES the catalog and all orders/reviews. ` +
        `Set SEED_ALLOW_REMOTE=1 only for a deliberate, user-approved production re-seed.`
    );
  }
}

async function main() {
  assertLocalDatabase();
  console.log("Starting database seed...\n");

  // 0. CATALOG + TRANSACTIONAL RESET
  // Users, subscribers, settings, and the supplier record survive (upserted
  // below); everything catalog-shaped is rebuilt from seed-data so stale rows
  // can't linger next to the new catalog. Order matches FK dependencies:
  // reviews/supplier orders/order items before orders; cart items before
  // variants/images before products; subcategories before parent categories.
  console.log("Resetting catalog and transactional data...");
  await prisma.review.deleteMany();
  await prisma.supplierOrder.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany({ where: { parentId: { not: null } } });
  await prisma.category.deleteMany();
  console.log("  catalog reset complete\n");

  // 1. USERS
  console.log("Creating users...");
  const userMap = new Map<string, string>();

  // Seed passwords come from the environment, never from source (G17 F1).
  // Locally an unset var yields a fresh random password, printed once below;
  // a non-local target must name one explicitly or the resolver throws.
  const isLocalHost = isLocalDatabaseHost();
  const generate = () => randomBytes(24).toString("base64url");
  const adminPassword = resolveSeedPassword(process.env.SEED_ADMIN_PASSWORD, {
    isLocalHost,
    generate,
    envVar: "SEED_ADMIN_PASSWORD",
  });
  const customerPassword = resolveSeedPassword(process.env.SEED_CUSTOMER_PASSWORD, {
    isLocalHost,
    generate,
    envVar: "SEED_CUSTOMER_PASSWORD",
  });

  const adminHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email: adminUser.email },
    update: {},
    create: {
      email: adminUser.email,
      name: adminUser.name,
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });
  userMap.set(admin.email, admin.id);

  for (const c of testCustomers) {
    const hash = await bcrypt.hash(customerPassword, SALT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: { name: c.name },
      create: {
        email: c.email,
        name: c.name,
        passwordHash: hash,
        role: Role.CUSTOMER,
      },
    });
    userMap.set(user.email, user.id);
  }
  // Print a generated password once so local dev can log in. Only meaningful
  // for accounts this run CREATED: the upserts above use `update: {}` for the
  // admin, so an account that already existed keeps the password it had.
  if (!process.env.SEED_ADMIN_PASSWORD?.trim()) {
    console.log(`  admin password (generated): ${adminPassword}`);
  }
  if (!process.env.SEED_CUSTOMER_PASSWORD?.trim()) {
    console.log(`  customer password (generated): ${customerPassword}`);
  }
  if (!process.env.SEED_ADMIN_PASSWORD?.trim() || !process.env.SEED_CUSTOMER_PASSWORD?.trim()) {
    console.log("  (accounts that already existed keep their previous password)");
  }
  console.log(`  ${userMap.size} users`);

  // 2. CATEGORIES
  console.log("Creating categories...");
  const categoryMap = new Map<string, string>();

  for (const cat of topLevelCategories) {
    const c = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        image: cat.image,
        sortOrder: cat.sortOrder,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        image: cat.image,
        isActive: true,
        sortOrder: cat.sortOrder,
      },
    });
    categoryMap.set(c.slug, c.id);
  }

  for (const sub of subcategories) {
    const parentId = categoryMap.get(sub.parentSlug);
    if (!parentId) throw new Error(`Parent category "${sub.parentSlug}" not found`);
    const c = await prisma.category.upsert({
      where: { slug: sub.slug },
      update: { name: sub.name, description: sub.description, parentId, sortOrder: sub.sortOrder },
      create: {
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        parentId,
        isActive: true,
        sortOrder: sub.sortOrder,
      },
    });
    categoryMap.set(c.slug, c.id);
  }
  console.log(
    `  ${categoryMap.size} categories (${topLevelCategories.length} top-level, ${subcategories.length} sub)`
  );

  // 3. SUPPLIER
  console.log("Creating supplier...");
  const supplier = await prisma.supplier.upsert({
    where: { code: "MANUAL" },
    update: {},
    create: {
      name: "Manual Supplier",
      code: "MANUAL",
      email: "supplier@example.com",
      isActive: true,
      notes: "Default supplier for manually added products",
    },
  });

  // 4. PRODUCTS
  console.log("Creating products...");
  const productMap = new Map<string, string>();

  for (const p of products) {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId)
      throw new Error(`Category "${p.categorySlug}" not found for product "${p.sku}"`);

    const scalarFields = {
      name: p.name,
      slug: p.slug,
      description: p.description,
      shortDesc: p.shortDesc,
      price: p.price,
      comparePrice: p.comparePrice ?? null,
      stock: p.stock,
      isFeatured: p.isFeatured,
      categoryId,
      supplierId: supplier.id,
      brand: p.brand,
      barcode: p.barcode,
      mpn: p.mpn,
      styleGroup: p.styleGroup ?? null,
      isActive: true,
      createdAt: p.createdAt,
    };

    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        ...scalarFields,
        images: { deleteMany: {}, create: p.images },
        variants: { deleteMany: {}, create: p.variants ?? [] },
      },
      create: {
        ...scalarFields,
        sku: p.sku,
        images: { create: p.images },
        variants: { create: p.variants ?? [] },
      },
    });
    productMap.set(p.sku, product.id);
  }
  console.log(`  ${productMap.size} products`);

  // 5. ORDERS
  console.log("Creating orders...");
  const orderMap = new Map<string, { id: string; userId: string; productSkus: string[] }>();

  for (const o of orders) {
    const userId = userMap.get(o.customerEmail);
    if (!userId)
      throw new Error(`User "${o.customerEmail}" not found for order "${o.orderNumber}"`);

    const subtotal = o.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const shippingCost = 80; // Нова Пошта відділення flat placeholder (real rates: TASK-049)
    const tax = 0; // no VAT itemization in the demo
    const total = subtotal + shippingCost + tax;

    const orderItems = o.items.map((i) => {
      const productId = productMap.get(i.productSku);
      if (!productId)
        throw new Error(`Product "${i.productSku}" not found for order "${o.orderNumber}"`);
      return {
        productId,
        productName: i.productName,
        productSku: i.productSku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: Math.round(i.unitPrice * i.quantity * 100) / 100,
      };
    });

    const order = await prisma.order.upsert({
      where: { orderNumber: o.orderNumber },
      update: {
        status: o.status as OrderStatus,
        paymentStatus: o.paymentStatus as PaymentStatus,
        items: { deleteMany: {}, create: orderItems },
      },
      create: {
        orderNumber: o.orderNumber,
        userId,
        email: o.customerEmail,
        status: o.status as OrderStatus,
        paymentStatus: o.paymentStatus as PaymentStatus,
        paidAt: o.paymentStatus === "PAID" ? o.createdAt : null,
        subtotal,
        shippingCost,
        tax,
        discount: 0,
        total,
        shippingAddress: o.shippingAddress,
        items: { create: orderItems },
        createdAt: o.createdAt,
      },
    });

    orderMap.set(o.orderNumber, {
      id: order.id,
      userId,
      productSkus: o.items.map((i) => i.productSku),
    });
  }
  console.log(`  ${orderMap.size} orders`);

  // 6. REVIEWS
  console.log("Creating reviews...");
  let reviewCount = 0;

  for (const r of reviews) {
    const userId = userMap.get(r.customerEmail);
    if (!userId) throw new Error(`User "${r.customerEmail}" not found for review`);

    const productId = productMap.get(r.productSku);
    if (!productId) throw new Error(`Product "${r.productSku}" not found for review`);

    const orderData = orderMap.get(r.orderNumber);
    if (!orderData) throw new Error(`Order "${r.orderNumber}" not found for review`);
    if (!orderData.productSkus.includes(r.productSku)) {
      throw new Error(`Order "${r.orderNumber}" does not contain product "${r.productSku}"`);
    }

    await prisma.review.upsert({
      where: { userId_productId: { userId, productId } },
      update: {
        rating: r.rating,
        comment: r.comment,
        adminReply: r.adminReply ?? null,
        adminRepliedAt: r.adminRepliedAt ?? null,
      },
      create: {
        userId,
        productId,
        orderId: orderData.id,
        rating: r.rating,
        comment: r.comment,
        adminReply: r.adminReply ?? null,
        adminRepliedAt: r.adminRepliedAt ?? null,
        createdAt: r.createdAt,
      },
    });
    reviewCount++;
  }
  console.log(`  ${reviewCount} reviews`);

  // 7. NEWSLETTER SUBSCRIBERS
  console.log("Creating subscribers...");
  let subCount = 0;

  for (const s of subscribers) {
    await prisma.subscriber.upsert({
      where: { email: s.email },
      update: { status: s.status as SubscriberStatus },
      create: {
        email: s.email,
        status: s.status as SubscriberStatus,
        confirmationToken: s.confirmationToken ?? null,
        confirmationExpiry: s.confirmationExpiry ?? null,
        subscribedAt: s.subscribedAt ?? null,
        unsubscribedAt: s.unsubscribedAt ?? null,
        createdAt: s.createdAt,
      },
    });
    subCount++;
  }
  console.log(`  ${subCount} subscribers`);

  // 8. SETTINGS
  console.log("Creating settings...");
  const settingsData = [
    { key: "store_name", value: "Mirox Shop", type: "string" },
    { key: "store_currency", value: "USD", type: "string" },
    { key: "shipping_flat_rate", value: "5.99", type: "number" },
    { key: "free_shipping_threshold", value: "50", type: "number" },
  ];
  for (const s of settingsData) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log(`  ${settingsData.length} settings`);

  // SUMMARY
  console.log("\nSeed completed successfully!");
  console.log("\nTest accounts (passwords shown in the users step above):");
  console.log(`  Admin: ${adminUser.email}`);
  for (const c of testCustomers) {
    console.log(`  Customer: ${c.email}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
