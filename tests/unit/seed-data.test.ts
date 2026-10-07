import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { subcategories, topLevelCategories } from "../../prisma/seed-data/categories";
import { orders } from "../../prisma/seed-data/orders";
import { products } from "../../prisma/seed-data/products";
import { reviews } from "../../prisma/seed-data/reviews";
import { adminUser, testCustomers } from "../../prisma/seed-data/users";

const slugs = new Set([...topLevelCategories, ...subcategories].map((c) => c.slug));
const skus = new Set(products.map((p) => p.sku));
const emails = new Set([adminUser.email, ...testCustomers.map((u) => u.email)]);
const orderNumbers = new Map(orders.map((o) => [o.orderNumber, o]));

describe("seed data integrity (mirrors seed.ts fail-fast guards)", () => {
  it("every product references an existing category and a unique slug/SKU", () => {
    expect(products.length).toBeGreaterThanOrEqual(8);
    expect(new Set(products.map((p) => p.slug)).size).toBe(products.length);
    expect(skus.size).toBe(products.length);
    for (const p of products) expect(slugs.has(p.categorySlug), p.sku).toBe(true);
  });

  it("prices are positive UAH integers; comparePrice always exceeds price", () => {
    for (const p of products) {
      expect(Number.isInteger(p.price), p.sku).toBe(true);
      expect(p.price).toBeGreaterThan(0);
      if (p.comparePrice) expect(p.comparePrice).toBeGreaterThan(p.price);
    }
  });

  it("every product image file exists under public/", () => {
    for (const p of products)
      for (const img of p.images)
        expect(existsSync(join(process.cwd(), "public", img.url)), img.url).toBe(true);
  });

  it("orders reference real users and SKUs", () => {
    for (const o of orders) {
      expect(emails.has(o.customerEmail), o.orderNumber).toBe(true);
      for (const i of o.items) expect(skus.has(i.productSku), i.productSku).toBe(true);
    }
  });

  it("reviews reference DELIVERED orders that contain the reviewed SKU", () => {
    for (const r of reviews) {
      const order = orderNumbers.get(r.orderNumber);
      expect(order, r.orderNumber).toBeDefined();
      expect(order!.status).toBe("DELIVERED");
      expect(order!.items.some((i) => i.productSku === r.productSku)).toBe(true);
      expect(order!.customerEmail).toBe(r.customerEmail);
    }
  });

  it("supplies the homepage: ≥4 featured products and ≥2 testimonial-grade reviews", () => {
    expect(products.filter((p) => p.isFeatured).length).toBeGreaterThanOrEqual(4);
    expect(reviews.filter((r) => r.rating >= 4 && r.comment).length).toBeGreaterThanOrEqual(2);
  });

  // TASK-057 (Task 6): the homepage "Новинки" rail orders by createdAt desc —
  // this locks in the mockup's exact featured order (Худі Basic, Футболка,
  // Олімпійка, Худі White) against a future reordering/edit of the seed data.
  it("the four newest products by createdAt are exactly MRX-001..004, in order", () => {
    const sorted = [...products].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    expect(sorted.slice(0, 4).map((p) => p.sku)).toEqual([
      "MRX-001",
      "MRX-002",
      "MRX-003",
      "MRX-004",
    ]);
  });

  // G16: leaf categories — Светри (Одяг) and Рюкзаки (Аксесуари).
  it("seeds the G16 leaf categories under the right parents", () => {
    const bySlug = new Map(subcategories.map((s) => [s.slug, s]));
    expect(bySlug.get("svetry")?.parentSlug).toBe("odyah");
    expect(bySlug.get("ryukzaky")?.parentSlug).toBe("aksesuary");
    expect(new Set(subcategories.map((s) => s.slug)).size).toBe(subcategories.length);
  });
});

describe("colorway integrity (TASK-037)", () => {
  it("every product has exactly one Колір variant row", () => {
    for (const p of products) {
      const colors = (p.variants ?? []).filter((v) => v.name === "Колір");
      expect(colors, `${p.slug} must have exactly one Колір row`).toHaveLength(1);
    }
  });

  it("styleGroup links exactly the Худі Basic/White pair", () => {
    const grouped = products.filter((p) => p.styleGroup !== undefined);
    expect(grouped.map((p) => p.slug).sort()).toEqual(["hudi-mirox-basic", "hudi-mirox-white"]);
    expect(new Set(grouped.map((p) => p.styleGroup)).size).toBe(1);
  });
});
