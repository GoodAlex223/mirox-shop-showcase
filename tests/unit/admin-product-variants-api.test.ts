// tests/unit/admin-product-variants-api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest, createRouteParams } from "../helpers/api-test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    product: { findUnique: vi.fn() },
    productVariant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET, POST } from "@/app/api/admin/products/[id]/variants/route";
import { PATCH, DELETE } from "@/app/api/admin/products/[id]/variants/[variantId]/route";

const adminSession = { user: { id: "admin-1", email: "a@t.com", role: "ADMIN" }, expires: "" };
const customerSession = { user: { id: "u1", email: "c@t.com", role: "CUSTOMER" }, expires: "" };
const params = createRouteParams({ id: "p1" });
const itemParams = createRouteParams({ id: "p1", variantId: "v1" });

const sizeM = { id: "v1", productId: "p1", name: "Розмір", value: "M", stock: 5 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(adminSession as never);
  vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: "p1" } as never);
  vi.mocked(prisma.productVariant.findFirst).mockResolvedValue(null);
});

describe("GET /api/admin/products/[id]/variants", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(createNextRequest({ url: "/api/admin/products/p1/variants" }), params);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin", async () => {
    vi.mocked(auth).mockResolvedValue(customerSession as never);
    const res = await GET(createNextRequest({ url: "/api/admin/products/p1/variants" }), params);
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
    const res = await GET(createNextRequest({ url: "/api/admin/products/p1/variants" }), params);
    expect(res.status).toBe(404);
  });

  it("lists the product's variants in creation order", async () => {
    vi.mocked(prisma.productVariant.findMany).mockResolvedValue([sizeM] as never);
    const res = await GET(createNextRequest({ url: "/api/admin/products/p1/variants" }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([sizeM]);
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: "p1" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
    );
  });
});

describe("POST /api/admin/products/[id]/variants", () => {
  const post = (body: Record<string, unknown>) =>
    POST(
      createNextRequest({ url: "/api/admin/products/p1/variants", method: "POST", body }),
      params
    );

  it("creates a Розмір variant", async () => {
    vi.mocked(prisma.productVariant.create).mockResolvedValue(sizeM as never);
    const res = await post({ name: "Розмір", value: "M", stock: 5 });
    expect(res.status).toBe(201);
    expect(prisma.productVariant.create).toHaveBeenCalledWith({
      data: { productId: "p1", name: "Розмір", value: "M", stock: 5 },
    });
  });

  it("creates a Колір variant", async () => {
    vi.mocked(prisma.productVariant.create).mockResolvedValue({
      ...sizeM,
      id: "v2",
      name: "Колір",
      value: "Чорний",
    } as never);
    const res = await post({ name: "Колір", value: "Чорний", stock: 20 });
    expect(res.status).toBe(201);
  });

  // The load-bearing guard (spec §3): a hand-typed English name would silently
  // break every storefront variant lookup and both catalog facets.
  it.each(["Size", "Color", "size", "Розмір ", "Колiр"])(
    "rejects the non-canonical name %j with 400 and never touches the DB",
    async (name) => {
      const res = await post({ name, value: "M", stock: 5 });
      expect(res.status).toBe(400);
      expect(prisma.productVariant.create).not.toHaveBeenCalled();
    }
  );

  it("rejects an empty value and a negative stock", async () => {
    expect((await post({ name: "Розмір", value: "  ", stock: 5 })).status).toBe(400);
    expect((await post({ name: "Розмір", value: "M", stock: -1 })).status).toBe(400);
    expect((await post({ name: "Розмір", value: "M", stock: 1.5 })).status).toBe(400);
  });

  it("rejects a duplicate name+value on the same product with 400", async () => {
    vi.mocked(prisma.productVariant.findFirst).mockResolvedValue(sizeM as never);
    const res = await post({ name: "Розмір", value: "M", stock: 5 });
    expect(res.status).toBe(400);
    // The admin UI maps this `code` to a Ukrainian toast (never the English
    // `error` text) — pin the machine-readable half of that contract here.
    expect((await res.json()).code).toBe("DUPLICATE_VARIANT");
    expect(prisma.productVariant.create).not.toHaveBeenCalled();
    // Pin the scoping: a route that only scoped by productId (rejecting
    // every second variant on a product) would pass the assertions above
    // unchanged.
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { productId: "p1", name: "Розмір", value: "M" },
      select: { id: true },
    });
  });

  it("returns 404 for an unknown product", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
    expect((await post({ name: "Розмір", value: "M", stock: 5 })).status).toBe(404);
  });
});

describe("PATCH /api/admin/products/[id]/variants/[variantId]", () => {
  const patch = (body: Record<string, unknown>) =>
    PATCH(
      createNextRequest({ url: "/api/admin/products/p1/variants/v1", method: "PATCH", body }),
      itemParams
    );

  it("updates value and stock", async () => {
    // Call 1: the ownership existence check. Call 2: the sibling-duplicate
    // guard — no collision, so the update proceeds.
    vi.mocked(prisma.productVariant.findFirst)
      .mockResolvedValueOnce(sizeM as never)
      .mockResolvedValueOnce(null as never);
    vi.mocked(prisma.productVariant.update).mockResolvedValue({ ...sizeM, stock: 9 } as never);
    const res = await patch({ stock: 9 });
    expect(res.status).toBe(200);
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { stock: 9 },
    });
  });

  it("still rejects a non-canonical name on update", async () => {
    vi.mocked(prisma.productVariant.findFirst).mockResolvedValue(sizeM as never);
    expect((await patch({ name: "Size" })).status).toBe(400);
    expect(prisma.productVariant.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the variant is not on this product", async () => {
    vi.mocked(prisma.productVariant.findFirst).mockResolvedValue(null);
    expect((await patch({ stock: 1 })).status).toBe(404);
    // Pin the ownership scoping: a lookup that dropped `productId` would
    // pass the assertion above unchanged while letting an admin PATCH a
    // variant belonging to a different product by guessing its id.
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: "v1", productId: "p1" },
    });
  });

  it("rejects a PATCH that would collide with an existing sibling variant with 400", async () => {
    const sizeL = { id: "v2", productId: "p1", name: "Розмір", value: "L", stock: 3 };
    // Call 1: the ownership existence check (v1, currently Розмір/M).
    // Call 2: the sibling-duplicate guard finds Розмір/L already on p1.
    vi.mocked(prisma.productVariant.findFirst)
      .mockResolvedValueOnce(sizeM as never)
      .mockResolvedValueOnce(sizeL as never);
    const res = await patch({ value: "L" });
    expect(res.status).toBe(400);
    expect(prisma.productVariant.update).not.toHaveBeenCalled();
    // The exclusion is load-bearing: without `id: { not: variantId }` a
    // no-op PATCH would self-match and every PATCH would 400.
    expect(prisma.productVariant.findFirst).toHaveBeenLastCalledWith({
      where: { productId: "p1", name: "Розмір", value: "L", id: { not: "v1" } },
      select: { id: true },
    });
  });
});

describe("DELETE /api/admin/products/[id]/variants/[variantId]", () => {
  const del = () =>
    DELETE(
      createNextRequest({ url: "/api/admin/products/p1/variants/v1", method: "DELETE" }),
      itemParams
    );

  it("deletes an unreferenced variant", async () => {
    vi.mocked(prisma.productVariant.findFirst).mockResolvedValue({
      ...sizeM,
      _count: { orderItems: 0, cartItems: 0 },
    } as never);
    const res = await del();
    expect(res.status).toBe(200);
    expect(prisma.productVariant.delete).toHaveBeenCalledWith({ where: { id: "v1" } });
  });

  it("refuses with 400 when orders or carts reference the variant", async () => {
    vi.mocked(prisma.productVariant.findFirst).mockResolvedValue({
      ...sizeM,
      _count: { orderItems: 2, cartItems: 0 },
    } as never);
    const res = await del();
    expect(res.status).toBe(400);
    // The admin UI maps this `code` to a Ukrainian toast (never the English
    // `error` text) — pin the machine-readable half of that contract here.
    expect((await res.json()).code).toBe("VARIANT_REFERENCED");
    expect(prisma.productVariant.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when not found", async () => {
    vi.mocked(prisma.productVariant.findFirst).mockResolvedValue(null);
    expect((await del()).status).toBe(404);
    // Pin the ownership scoping: a lookup that dropped `productId` would
    // pass the assertion above unchanged while letting an admin delete a
    // variant belonging to a different product by guessing its id.
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: "v1", productId: "p1" },
      include: { _count: { select: { orderItems: true, cartItems: true } } },
    });
  });
});
