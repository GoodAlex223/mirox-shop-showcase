// tests/unit/admin-categories-api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNextRequest, createRouteParams } from "../helpers/api-test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    category: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/admin/categories/route";
import { PUT } from "@/app/api/admin/categories/[id]/route";

type Row = Record<string, unknown>;

const adminSession = { user: { id: "admin-1", email: "a@t.com", role: "ADMIN" }, expires: "" };

/** A category table behind findUnique: a row matches when every `where` key does. */
function seedCategories(rows: Row[]) {
  vi.mocked(prisma.category.findUnique).mockImplementation(
    (async ({ where }: { where: Row }) =>
      rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ??
      null) as never
  );
}

const createdData = () => vi.mocked(prisma.category.create).mock.calls[0][0].data as Row;
const updatedData = () => vi.mocked(prisma.category.update).mock.calls[0][0].data as Row;

const post = (body: Row) =>
  POST(createNextRequest({ url: "/api/admin/categories", method: "POST", body }));
const put = (body: Row) =>
  PUT(
    createNextRequest({ url: "/api/admin/categories/c1", method: "PUT", body }),
    createRouteParams({ id: "c1" })
  );
const codeOf = async (res: Response) => ((await res.json()) as { code?: string }).code;

// What the admin dialog submits for a new category: every form field, the slug
// still blank because the name was Cyrillic, a blank image sent as null.
const dialogCreate: Row = {
  name: "Светри",
  slug: "",
  description: "",
  image: null,
  parentId: null,
  isActive: true,
  sortOrder: 0,
};

const stored = { id: "c1", name: "Светри", slug: "svetry", parentId: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(adminSession as never);
  vi.mocked(prisma.category.create).mockImplementation(
    async ({ data }: never) => ({ id: "new", ...(data as object) }) as never
  );
  vi.mocked(prisma.category.update).mockImplementation(
    async ({ data }: never) => ({ ...stored, ...(data as object) }) as never
  );
});

describe("POST /api/admin/categories — G24 slug rule", () => {
  beforeEach(() => seedCategories([]));

  it("stores a transliterated slug for a Cyrillic name sent with a blank slug", async () => {
    const res = await post(dialogCreate);
    expect(res.status).toBe(201);
    expect(createdData().slug).toBe("svetry");
  });

  it("generates the slug when the body carries no slug key at all", async () => {
    const body: Row = { ...dialogCreate };
    delete body.slug;
    const res = await post(body);
    expect(res.status).toBe(201);
    expect(createdData().slug).toBe("svetry");
  });

  it("normalizes a typed slug", async () => {
    const res = await post({ ...dialogCreate, slug: "Svetry Novi" });
    expect(res.status).toBe(201);
    expect(createdData().slug).toBe("svetry-novi");
  });

  it("treats a whitespace-only slug as blank and generates from the name", async () => {
    const res = await post({ ...dialogCreate, slug: "   " });
    expect(res.status).toBe(201);
    expect(createdData().slug).toBe("svetry");
  });

  it.each([
    ["a typed slug with no letter or digit", { ...dialogCreate, slug: "!!!" }],
    ["a name with no letter or digit and a blank slug", { ...dialogCreate, name: "★★★" }],
  ])("rejects %s with SLUG_EMPTY and creates nothing", async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SLUG_EMPTY");
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it("suffixes a generated slug that another category already holds", async () => {
    seedCategories([{ id: "c9", slug: "svetry" }]);
    const res = await post(dialogCreate);
    expect(res.status).toBe(201);
    expect(createdData().slug).toMatch(/^svetry-[0-9a-z]+$/);
  });
});

describe("POST /api/admin/categories — the dialog's other fields", () => {
  beforeEach(() => seedCategories([]));

  it("persists the image and sort order the dialog sends", async () => {
    const res = await post({
      ...dialogCreate,
      image: "https://cdn.example.com/svetry.jpg",
      sortOrder: 6,
    });
    expect(res.status).toBe(201);
    expect(createdData()).toEqual(
      expect.objectContaining({ image: "https://cdn.example.com/svetry.jpg", sortOrder: 6 })
    );
  });
});

describe("POST /api/admin/categories — G24 coded outcomes", () => {
  beforeEach(() => seedCategories([]));

  it("PARENT_NOT_FOUND when the parent does not exist", async () => {
    const res = await post({ ...dialogCreate, parentId: "c404" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("PARENT_NOT_FOUND");
  });

  it("VALIDATION_ERROR for a body the schema rejects", async () => {
    const res = await post({ ...dialogCreate, image: "not a url" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("VALIDATION_ERROR");
  });

  it("CREATE_FAILED when the database write throws", async () => {
    vi.mocked(prisma.category.create).mockRejectedValue(new Error("db down"));
    const res = await post(dialogCreate);
    expect(res.status).toBe(500);
    expect(await codeOf(res)).toBe("CREATE_FAILED");
  });
});

describe("PUT /api/admin/categories/[id] — G24 slug rule", () => {
  beforeEach(() => seedCategories([stored]));

  it("regenerates a transliterated slug on a rename with the slug field cleared", async () => {
    const res = await put({ name: "Худі", slug: "" });
    expect(res.status).toBe(200);
    expect(updatedData().slug).toBe("khudi");
  });

  it("SLUG_EMPTY instead of overwriting the slug when a rename leaves nothing to keep", async () => {
    const res = await put({ name: "★★★", slug: "" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SLUG_EMPTY");
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only slug as blank on a rename", async () => {
    const res = await put({ name: "Худі", slug: "   " });
    expect(res.status).toBe(200);
    expect(updatedData().slug).toBe("khudi");
  });

  it("keeps a slug sent back unchanged, even one generateSlug would rewrite", async () => {
    seedCategories([{ ...stored, slug: "Legacy Slug" }]);
    const res = await put({ name: "Светри", slug: "Legacy Slug" });
    expect(res.status).toBe(200);
    expect(updatedData().slug).toBe("Legacy Slug");
  });

  it("keeps the slug on a rename when the field still holds the stored slug", async () => {
    // The edit dialog pre-fills the slug: renaming must not move the category's URL.
    const res = await put({ name: "Светри та кардигани", slug: "svetry" });
    expect(res.status).toBe(200);
    expect(updatedData().slug).toBe("svetry");
  });

  it("normalizes a changed typed slug", async () => {
    const res = await put({ slug: "Svetry Novi" });
    expect(res.status).toBe(200);
    expect(updatedData().slug).toBe("svetry-novi");
  });

  it("treats a typed slug that normalizes to the stored one as unchanged, not taken", async () => {
    const res = await put({ slug: "Svetry" });
    expect(res.status).toBe(200);
    expect(updatedData().slug).toBe("svetry");
  });

  it("SLUG_TAKEN when another category holds the changed slug", async () => {
    seedCategories([stored, { id: "c2", slug: "svetry-novi" }]);
    const res = await put({ slug: "Svetry Novi" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SLUG_TAKEN");
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("SLUG_EMPTY when a changed typed slug normalizes to nothing", async () => {
    const res = await put({ slug: "!!!" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SLUG_EMPTY");
    expect(prisma.category.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/categories/[id] — G24 coded outcomes", () => {
  beforeEach(() => seedCategories([stored]));

  it("CATEGORY_NOT_FOUND for an unknown id", async () => {
    seedCategories([]);
    const res = await put({ name: "Худі" });
    expect(res.status).toBe(404);
    expect(await codeOf(res)).toBe("CATEGORY_NOT_FOUND");
  });

  it("SELF_PARENT when a category is made its own parent", async () => {
    const res = await put({ parentId: "c1" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("SELF_PARENT");
  });

  it("CIRCULAR_PARENT when the new parent descends from the category", async () => {
    seedCategories([
      stored,
      { id: "c2", slug: "a", parentId: "c1" },
      { id: "c3", slug: "b", parentId: "c2" },
    ]);
    const res = await put({ parentId: "c3" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("CIRCULAR_PARENT");
  });

  it("PARENT_NOT_FOUND when the new parent does not exist", async () => {
    const res = await put({ parentId: "c404" });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("PARENT_NOT_FOUND");
  });

  it("VALIDATION_ERROR for a body the schema rejects", async () => {
    const res = await put({ sortOrder: -1 });
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("VALIDATION_ERROR");
  });

  it("UPDATE_FAILED when the database write throws", async () => {
    vi.mocked(prisma.category.update).mockRejectedValue(new Error("db down"));
    const res = await put({ name: "Худі" });
    expect(res.status).toBe(500);
    expect(await codeOf(res)).toBe("UPDATE_FAILED");
  });
});
