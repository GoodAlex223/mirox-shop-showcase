// tests/unit/admin-products-api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest, createRouteParams } from "../helpers/api-test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    product: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    category: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/admin/products/route";
import { PUT } from "@/app/api/admin/products/[id]/route";

const adminSession = { user: { id: "admin-1", email: "a@t.com", role: "ADMIN" }, expires: "" };

const validBody = {
  name: "Олімпійка з лампасами, чорна",
  slug: "olimpiyka-lampasy-chorna",
  price: 1749,
  sku: "MRX-101",
  stock: 20,
  categoryId: "cat-1",
};

const existing = {
  id: "p1",
  name: "Old",
  slug: "old",
  sku: "MRX-001",
  categoryId: "cat-1",
  styleGroup: null,
  excludeFromFeed: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(adminSession as never);
  vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: "cat-1" } as never);
  vi.mocked(prisma.product.create).mockImplementation(
    async ({ data }: never) => ({ id: "new", ...(data as object) }) as never
  );
  vi.mocked(prisma.product.update).mockImplementation(
    async ({ data }: never) => ({ ...existing, ...(data as object) }) as never
  );
});

describe("POST /api/admin/products — G16 fields", () => {
  it("persists styleGroup and excludeFromFeed when sent", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
    const req = createNextRequest({
      url: "/api/admin/products",
      method: "POST",
      body: { ...validBody, styleGroup: "olimpiyka-lampasy", excludeFromFeed: true },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.product.create).mock.calls[0][0].data;
    expect(data).toEqual(
      expect.objectContaining({ styleGroup: "olimpiyka-lampasy", excludeFromFeed: true })
    );
  });

  it("leaves excludeFromFeed to the DB default when omitted (does not force false)", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
    const res = await POST(
      createNextRequest({ url: "/api/admin/products", method: "POST", body: validBody })
    );
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.product.create).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.excludeFromFeed).toBeUndefined();
  });

  it("rejects a styleGroup longer than 100 characters", async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(null);
    const res = await POST(
      createNextRequest({
        url: "/api/admin/products",
        method: "POST",
        body: { ...validBody, styleGroup: "x".repeat(101) },
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/admin/products/[id] — G16 fields", () => {
  beforeEach(() => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue(existing as never);
  });

  it("updates styleGroup and excludeFromFeed when sent", async () => {
    const req = createNextRequest({
      url: "/api/admin/products/p1",
      method: "PUT",
      body: { styleGroup: "svetr-blyskavka", excludeFromFeed: false },
    });
    const res = await PUT(req, createRouteParams({ id: "p1" }));
    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.product.update).mock.calls[0][0].data;
    expect(data).toEqual(
      expect.objectContaining({ styleGroup: "svetr-blyskavka", excludeFromFeed: false })
    );
  });

  it("clears styleGroup when null is sent (un-links the colourway)", async () => {
    const req = createNextRequest({
      url: "/api/admin/products/p1",
      method: "PUT",
      body: { styleGroup: null },
    });
    await PUT(req, createRouteParams({ id: "p1" }));
    const data = vi.mocked(prisma.product.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.styleGroup).toBeNull();
  });

  // The teeth: Zod 4 keeps .default() under .partial(), so a defaulted flag
  // would be reset to false by ANY partial PUT and silently re-enter the feed.
  it("a partial PUT that omits excludeFromFeed does not touch it", async () => {
    const req = createNextRequest({
      url: "/api/admin/products/p1",
      method: "PUT",
      body: { name: "Renamed" },
    });
    const res = await PUT(req, createRouteParams({ id: "p1" }));
    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.product.update).mock.calls[0][0].data as Record<string, unknown>;
    expect("excludeFromFeed" in data).toBe(false);
    expect("styleGroup" in data).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// G24 — one slug rule for both write paths, and a machine code on every outcome
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** A product table behind findUnique: a row matches when every `where` key does. */
function seedProducts(rows: Row[]) {
  vi.mocked(prisma.product.findUnique).mockImplementation(
    (async ({ where }: { where: Row }) =>
      rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ??
      null) as never
  );
}

const createdData = () => vi.mocked(prisma.product.create).mock.calls[0][0].data as Row;
const updatedData = () => vi.mocked(prisma.product.update).mock.calls[0][0].data as Row;

const post = (body: Row) =>
  POST(createNextRequest({ url: "/api/admin/products", method: "POST", body }));
const put = (body: Row) =>
  PUT(
    createNextRequest({ url: "/api/admin/products/p1", method: "PUT", body }),
    createRouteParams({ id: "p1" })
  );
const codeOf = async (res: Response) => ((await res.json()) as { code?: string }).code;

// What ProductForm sends when the slug field is left blank: no `slug` key.
const blankSlugBody: Row = {
  name: validBody.name,
  price: validBody.price,
  sku: validBody.sku,
  stock: validBody.stock,
  categoryId: validBody.categoryId,
};

describe("POST /api/admin/products — G24 slug rule", () => {
  beforeEach(() => seedProducts([]));

  it("generates a transliterated slug from a Ukrainian name when none is typed", async () => {
    const res = await post(blankSlugBody);
    expect(res.status).toBe(201);
    expect(createdData().slug).toBe("olimpiika-z-lampasamy-chorna");
  });

  it.each([
    ["Svetr Chornyi", "svetr-chornyi"],
    ["Олімпійка чорна", "olimpiika-chorna"],
  ])("normalizes the typed slug %j to %s", async (typed, want) => {
    const res = await post({ ...validBody, slug: typed });
    expect(res.status).toBe(201);
    expect(createdData().slug).toBe(want);
  });

  it("treats a whitespace-only slug as blank and generates from the name", async () => {
    const res = await post({ ...validBody, slug: "   " });
    expect(res.status).toBe(201);
    expect(createdData().slug).toBe("olimpiika-z-lampasamy-chorna");
  });

  it.each([
    ["a typed slug with no letter or digit", { ...validBody, slug: "!!!" }],
    ["a name with no letter or digit and no slug", { ...blankSlugBody, name: "★★★" }],
  ])("rejects %s with SLUG_EMPTY and creates nothing", async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SLUG_EMPTY");
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it("suffixes a generated slug that another product already holds", async () => {
    seedProducts([{ id: "p9", slug: "olimpiika-z-lampasamy-chorna", sku: "MRX-900" }]);
    const res = await post(blankSlugBody);
    expect(res.status).toBe(201);
    expect(createdData().slug).toMatch(/^olimpiika-z-lampasamy-chorna-[0-9a-z]+$/);
  });
});

describe("POST /api/admin/products — G24 coded outcomes", () => {
  beforeEach(() => seedProducts([]));

  it("SKU_TAKEN when another product has the SKU", async () => {
    seedProducts([{ id: "p9", slug: "other", sku: "MRX-101" }]);
    const res = await post(validBody);
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SKU_TAKEN");
  });

  it("CATEGORY_NOT_FOUND when the category does not exist", async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null);
    const res = await post(validBody);
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("CATEGORY_NOT_FOUND");
  });

  it("VALIDATION_ERROR for a body the schema rejects", async () => {
    const res = await post({ ...validBody, price: -5 });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("VALIDATION_ERROR");
  });

  it("CREATE_FAILED when the database write throws", async () => {
    vi.mocked(prisma.product.create).mockRejectedValue(new Error("db down"));
    const res = await post(validBody);
    expect(res.status).toBe(500);
    expect(await codeOf(res)).toBe("CREATE_FAILED");
  });
});

describe("PUT /api/admin/products/[id] — G24 slug rule", () => {
  const stored = { ...existing, name: "Светр", slug: "svetr" };
  beforeEach(() => seedProducts([stored]));

  it("keeps a slug sent back unchanged, even one generateSlug would rewrite", async () => {
    seedProducts([{ ...stored, slug: "Legacy Slug" }]);
    const res = await put({ name: "Светр", slug: "Legacy Slug", stock: 4 });
    expect(res.status).toBe(200);
    expect(updatedData()).not.toHaveProperty("slug");
  });

  it("keeps the slug on a rename when the field still holds the stored slug", async () => {
    // The edit form pre-fills the slug: renaming a product must not move its URL.
    const res = await put({ name: "Светр на блискавці", slug: "svetr" });
    expect(res.status).toBe(200);
    expect(updatedData()).not.toHaveProperty("slug");
  });

  it("normalizes a changed typed slug", async () => {
    const res = await put({ slug: "Svetr Chornyi" });
    expect(res.status).toBe(200);
    expect(updatedData().slug).toBe("svetr-chornyi");
  });

  it("treats a typed slug that normalizes to the stored one as unchanged, not taken", async () => {
    const res = await put({ slug: "Svetr" });
    expect(res.status).toBe(200);
    expect(updatedData()).not.toHaveProperty("slug");
  });

  it("SLUG_TAKEN when another product holds the changed slug", async () => {
    seedProducts([stored, { id: "p2", slug: "svetr-chornyi", sku: "MRX-002" }]);
    const res = await put({ slug: "Svetr Chornyi" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SLUG_TAKEN");
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it("SLUG_EMPTY when a changed typed slug normalizes to nothing", async () => {
    const res = await put({ slug: "!!!" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SLUG_EMPTY");
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it("regenerates a transliterated slug on a rename with the slug field cleared", async () => {
    const res = await put({ name: "Худі оверсайз" });
    expect(res.status).toBe(200);
    expect(updatedData().slug).toBe("khudi-oversaiz");
  });

  it("treats a whitespace-only slug as blank on a rename", async () => {
    const res = await put({ name: "Худі оверсайз", slug: "   " });
    expect(res.status).toBe(200);
    expect(updatedData().slug).toBe("khudi-oversaiz");
  });

  it("SLUG_EMPTY, not an empty slug, when a rename leaves nothing to keep", async () => {
    const res = await put({ name: "★★★" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SLUG_EMPTY");
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it("keeps the slug when a rename with the field cleared regenerates the same slug", async () => {
    // «Светр» → «СВЕТР» regenerates `svetr`, which this product already holds:
    // that is not a collision, and the URL must not gain a suffix.
    const res = await put({ name: "СВЕТР" });
    expect(res.status).toBe(200);
    expect(updatedData()).not.toHaveProperty("slug");
  });

  it("leaves the slug alone when neither slug nor name is sent", async () => {
    const res = await put({ stock: 3 });
    expect(res.status).toBe(200);
    expect("slug" in updatedData()).toBe(false);
  });
});

describe("PUT /api/admin/products/[id] — G24 coded outcomes", () => {
  const stored = { ...existing, name: "Светр", slug: "svetr" };
  beforeEach(() => seedProducts([stored]));

  it("PRODUCT_NOT_FOUND for an unknown id", async () => {
    seedProducts([]);
    const res = await put({ stock: 3 });
    expect(res.status).toBe(404);
    expect(await codeOf(res)).toBe("PRODUCT_NOT_FOUND");
  });

  it("SKU_TAKEN when another product has the new SKU", async () => {
    seedProducts([stored, { id: "p2", slug: "other", sku: "MRX-777" }]);
    const res = await put({ sku: "MRX-777" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SKU_TAKEN");
  });

  it("CATEGORY_NOT_FOUND when the new category does not exist", async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null);
    const res = await put({ categoryId: "cat-9" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("CATEGORY_NOT_FOUND");
  });

  it("VALIDATION_ERROR for a body the schema rejects", async () => {
    const res = await put({ price: -1 });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("VALIDATION_ERROR");
  });

  it("UPDATE_FAILED when the database write throws", async () => {
    vi.mocked(prisma.product.update).mockRejectedValue(new Error("db down"));
    const res = await put({ stock: 3 });
    expect(res.status).toBe(500);
    expect(await codeOf(res)).toBe("UPDATE_FAILED");
  });
});
