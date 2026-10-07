import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createNextRequest } from "../helpers/api-test-utils";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    product: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/email", () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/checkout/create-order/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/email";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.product.findMany as unknown as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

const validBody = {
  email: "guest@example.com",
  shippingAddress: {
    name: "Тест Тестовий",
    line1: "Відділення №12",
    city: "Київ",
    country: "UA",
    phone: "+380501234567",
  },
  shippingMethod: "np-office",
  items: [{ productId: "prod-1", quantity: 2 }],
};

const dbProduct = {
  id: "prod-1",
  name: "Худі Mirox Basic",
  sku: "HUDI-1",
  price: 1290,
  variants: [],
};

function mockTx() {
  const tx = {
    order: {
      create: vi.fn().mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-TEST",
        items: [],
      }),
    },
    // updateMany, not update: the decrement carries a `stock: { gte }` guard
    // and the route reads `count` to detect an oversell (G17 F8). A fixture
    // still mocking `update` would make every assertion below vacuous.
    product: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    productVariant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  mockTransaction.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));
  return tx;
}

const originalSecret = process.env.NEXTAUTH_SECRET;

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-for-order-grants";
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(null);
  mockFindMany.mockResolvedValue([dbProduct]);
});
afterEach(() => {
  process.env.NEXTAUTH_SECRET = originalSecret;
});

describe("POST /api/checkout/create-order", () => {
  it("returns 400 when phone is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure-omit idiom
    const { phone: _p, ...noPhone } = validBody.shippingAddress;
    const res = await POST(
      createNextRequest({
        url: "/api/checkout/create-order",
        method: "POST",
        body: { ...validBody, shippingAddress: noPhone },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when items is empty", async () => {
    const res = await POST(
      createNextRequest({
        url: "/api/checkout/create-order",
        method: "POST",
        body: { ...validBody, items: [] },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown shipping method", async () => {
    const res = await POST(
      createNextRequest({
        url: "/api/checkout/create-order",
        method: "POST",
        body: { ...validBody, shippingMethod: "standard" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects the whole order when any item's product is missing or inactive", async () => {
    mockTx();
    const res = await POST(
      createNextRequest({
        url: "/api/checkout/create-order",
        method: "POST",
        body: {
          ...validBody,
          items: [
            { productId: "prod-1", quantity: 2 },
            { productId: "prod-deactivated", quantity: 5 },
          ],
        },
      })
    );
    // findMany (mocked) only returns prod-1 — no partial order, no phantom
    // decrement: the request 400s before the transaction (PR #29 r4).
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("PRODUCT_UNAVAILABLE");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 for a quantity above the per-line cap", async () => {
    mockTx();
    const res = await POST(
      createNextRequest({
        url: "/api/checkout/create-order",
        method: "POST",
        body: { ...validBody, items: [{ productId: "prod-1", quantity: 999999999 }] },
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ORDER_DATA");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 when a variantId does not belong to the ordered product", async () => {
    mockFindMany.mockResolvedValue([
      {
        ...dbProduct,
        variants: [{ id: "var-1", name: "Розмір", value: "L", price: 1390 }],
      },
    ]);
    const res = await POST(
      createNextRequest({
        url: "/api/checkout/create-order",
        method: "POST",
        body: {
          ...validBody,
          items: [{ productId: "prod-1", variantId: "var-of-other-product", quantity: 1 }],
        },
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_VARIANT");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("only orders active products (isActive gate in the catalog lookup)", async () => {
    mockTx();
    await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it("creates a guest COD order with PENDING status and server-computed totals", async () => {
    const tx = mockTx();
    const res = await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.orderNumber).toBe("ORD-TEST");
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
          status: "PENDING",
          paymentMethod: "cod",
          paymentStatus: "PENDING",
          subtotal: 2580, // 2 × 1290 from the DB price, never the client's
          shippingCost: 80, // np-office
          total: 2660,
        }),
      })
    );
  });

  it("sets the post-checkout grant cookie for the new order (G18 spec §1)", async () => {
    mockTx();
    const res = await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(res.status).toBe(200);
    const cookie = res.cookies.get("og_ORD-TEST");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
    expect(cookie?.value).toMatch(/^\d+\.[0-9a-f]{64}$/);
  });

  it("links the order to the signed-in user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-7", email: "user@example.com" } });
    const tx = mockTx();
    await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "user-7" }) })
    );
  });

  it("decrements product stock (no variant)", async () => {
    const tx = mockTx();
    await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "prod-1", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
  });

  it("decrements variant stock and uses the variant price when variantId given", async () => {
    mockFindMany.mockResolvedValue([
      {
        ...dbProduct,
        variants: [{ id: "var-1", name: "Розмір", value: "L", price: 1390 }],
      },
    ]);
    const tx = mockTx();
    await POST(
      createNextRequest({
        url: "/api/checkout/create-order",
        method: "POST",
        body: { ...validBody, items: [{ productId: "prod-1", variantId: "var-1", quantity: 1 }] },
      })
    );
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: "var-1", stock: { gte: 1 } },
      data: { stock: { decrement: 1 } },
    });
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subtotal: 1390, shippingCost: 80, total: 1470 }),
      })
    );
  });

  it("returns 400 when no ordered product exists in the DB", async () => {
    mockFindMany.mockResolvedValue([]);
    const res = await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(res.status).toBe(400);
  });

  it("sends the confirmation email with the order payload", async () => {
    mockTx();
    await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: "ORD-TEST", email: "guest@example.com" })
    );
  });

  it("passes hasAccount: false for guest orders", async () => {
    mockAuth.mockResolvedValue(null);
    mockTx();
    await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ hasAccount: false })
    );
  });

  it("passes hasAccount: true when a session user exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockTx();
    await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ hasAccount: true })
    );
  });

  it("awaits the confirmation email before responding (unawaited sends die at serverless freeze)", async () => {
    mockTx();
    let resolveSend!: (value?: unknown) => void;
    (sendOrderConfirmationEmail as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        })
    );
    const responsePromise = POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    const raceWinner = await Promise.race([
      responsePromise.then(() => "responded"),
      new Promise((resolve) => setTimeout(() => resolve("still-pending"), 100)),
    ]);
    expect(raceWinner).toBe("still-pending");
    resolveSend();
    expect((await responsePromise).status).toBe(200);
  });

  it("returns 500 when the transaction fails", async () => {
    mockTransaction.mockRejectedValue(new Error("db down"));
    const res = await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );
    expect(res.status).toBe(500);
  });
  // G17 / F8 (MEDIUM, 3/3 panel): this route is deliberately unauthenticated for
  // guest COD, and every call decremented stock unconditionally. Looping it with
  // quantity: 100 drove every product's stock negative, rendering the whole
  // catalogue out of stock (`isAvailable: isActive && stock > 0`) until an admin
  // restored each value by hand. The per-line cap added in PR #29 r6 bounded one
  // request; it did not stop repetition.
  it("rejects the order when a product has insufficient stock", async () => {
    const tx = mockTx();
    tx.product.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(expect.objectContaining({ code: "INSUFFICIENT_STOCK" }));
  });

  it("rejects the order when a variant has insufficient stock", async () => {
    mockFindMany.mockResolvedValue([
      { ...dbProduct, variants: [{ id: "var-1", name: "Розмір", value: "L", price: 1390 }] },
    ]);
    const tx = mockTx();
    tx.productVariant.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(
      createNextRequest({
        url: "/api/checkout/create-order",
        method: "POST",
        body: { ...validBody, items: [{ productId: "prod-1", variantId: "var-1", quantity: 1 }] },
      })
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(expect.objectContaining({ code: "INSUFFICIENT_STOCK" }));
  });

  it("sends no confirmation email when the order is rejected for stock", async () => {
    const tx = mockTx();
    tx.product.updateMany.mockResolvedValue({ count: 0 });

    await POST(
      createNextRequest({ url: "/api/checkout/create-order", method: "POST", body: validBody })
    );

    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout/create-order — Nova Poshta refs (G25)", () => {
  const NP_REFS = {
    npCityRef: "8d5a980d-391c-11dd-90d9-001a92567626",
    npWarehouseRef: "1ec09d88-e1c2-11e3-8c4a-0050568002cf",
  };

  function post(shippingAddress: Record<string, unknown>, shippingMethod = "np-office") {
    return POST(
      createNextRequest({
        url: "/api/checkout/create-order",
        method: "POST",
        body: {
          ...validBody,
          shippingMethod,
          shippingAddress: { ...validBody.shippingAddress, ...shippingAddress },
        },
      })
    );
  }

  it("stores both refs inside shippingAddress for a branch order", async () => {
    const tx = mockTx();
    const res = await post(NP_REFS);
    expect(res.status).toBe(200);
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingAddress: expect.objectContaining(NP_REFS),
        }),
      })
    );
  });

  it("accepts a courier order that carries only the city ref", async () => {
    mockTx();
    const res = await post({ npCityRef: NP_REFS.npCityRef }, "np-courier");
    expect(res.status).toBe(200);
  });

  it("rejects a warehouse ref on a courier order", async () => {
    mockTx();
    const res = await post(NP_REFS, "np-courier");
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ORDER_DATA");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects a warehouse ref without a city ref", async () => {
    mockTx();
    const res = await post({ npWarehouseRef: NP_REFS.npWarehouseRef });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ORDER_DATA");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects a malformed ref", async () => {
    mockTx();
    const res = await post({ npCityRef: "not-a-ref" });
    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
