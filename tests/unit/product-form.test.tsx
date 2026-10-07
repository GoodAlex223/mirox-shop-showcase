import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import { ProductForm } from "@/components/admin/ProductForm";

// jsdom has no ResizeObserver; ProductForm's isActive/isFeatured/excludeFromFeed
// switches use Radix Switch, whose internal useSize hook needs ResizeObserver
// and otherwise throws. No other test in this file mounts something that
// needs it either, so this is scoped here rather than the global test setup
// (see tests/unit/filter-bar.test.tsx for the same pattern with Radix Slider).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;

// The category picker is a Radix Select, which calls pointer-capture and
// scrollIntoView APIs jsdom does not implement.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

const fetchMock = vi.fn();

const product = {
  id: "p1",
  name: "Светр на блискавці, чорний",
  slug: "svetr-blyskavka-chornyi",
  description: "Опис",
  shortDesc: "Короткий",
  price: "1579",
  comparePrice: null,
  costPrice: null,
  sku: "MRX-103",
  barcode: null,
  brand: null,
  mpn: null,
  styleGroup: "svetr-blyskavka",
  excludeFromFeed: true,
  stock: 20,
  categoryId: "cat-svetry",
  isActive: true,
  isFeatured: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/admin/categories")) {
      return {
        ok: true,
        json: async () => [{ id: "cat-svetry", name: "Светри", parentId: "c-odyah" }],
      };
    }
    return { ok: true, json: async () => ({ id: "p1" }) };
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("ProductForm — G16 fields", () => {
  it("renders styleGroup and excludeFromFeed from the product", async () => {
    renderWithIntl(<ProductForm product={product} isEdit />);
    expect(screen.getByLabelText("Група кольорів")).toHaveValue("svetr-blyskavka");
    expect(screen.getByRole("switch", { name: "Не показувати у Google Shopping" })).toBeChecked();
  });

  it("submits styleGroup and excludeFromFeed in the PUT payload", async () => {
    renderWithIntl(<ProductForm product={product} isEdit />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled()); // categories loaded
    fireEvent.change(screen.getByLabelText("Група кольорів"), { target: { value: "new-group" } });
    fireEvent.click(screen.getByRole("switch", { name: "Не показувати у Google Shopping" }));
    fireEvent.click(screen.getByRole("button", { name: "Оновити товар" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(put).toBeDefined();
      const body = JSON.parse(put![1].body as string);
      expect(body.styleGroup).toBe("new-group");
      expect(body.excludeFromFeed).toBe(false);
    });
  });

  it("sends styleGroup: null when the field is emptied", async () => {
    renderWithIntl(<ProductForm product={product} isEdit />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Група кольорів"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Оновити товар" }));
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(JSON.parse(put![1].body as string).styleGroup).toBeNull();
    });
  });
});

describe("ProductForm — G24 intake safety", () => {
  const feedSwitch = () => screen.getByRole("switch", { name: "Не показувати у Google Shopping" });

  it("starts a new product excluded from the Google Shopping feed", () => {
    renderWithIntl(<ProductForm />);
    expect(feedSwitch()).toBeChecked();
  });

  it("shows a stored product's feed setting as stored — off stays off", () => {
    renderWithIntl(<ProductForm product={{ ...product, excludeFromFeed: false }} isEdit />);
    expect(feedSwitch()).not.toBeChecked();
  });

  it("sends excludeFromFeed: true when a new product is saved with the default", async () => {
    renderWithIntl(<ProductForm />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled()); // categories loaded
    fireEvent.change(screen.getByLabelText("Назва товару *"), {
      target: { value: "Олімпійка з лампасами, чорна" },
    });
    fireEvent.change(screen.getByLabelText("Ціна *"), { target: { value: "1749" } });
    fireEvent.change(screen.getByLabelText("SKU *"), { target: { value: "MRX-104" } });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Светри" }));
    fireEvent.click(screen.getByRole("button", { name: "Створити товар" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(post).toBeDefined();
      expect(JSON.parse(post![1].body as string).excludeFromFeed).toBe(true);
    });
  });

  it("generates a transliterated slug from a Ukrainian name", () => {
    renderWithIntl(<ProductForm />);
    fireEvent.change(screen.getByLabelText("Назва товару *"), {
      target: { value: "Олімпійка з лампасами, чорна" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Згенерувати з назви" }));
    expect(screen.getByLabelText("URL-слаг")).toHaveValue("olimpiika-z-lampasamy-chorna");
  });

  const failSave = (payload: { error: string; code?: string }) =>
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/admin/categories")) {
        return {
          ok: true,
          json: async () => [{ id: "cat-svetry", name: "Светри", parentId: "c-odyah" }],
        };
      }
      return { ok: false, json: async () => payload };
    });

  it("shows the Ukrainian copy for the API's code — never its English error", async () => {
    failSave({ error: "SKU already exists", code: "SKU_TAKEN" });
    renderWithIntl(<ProductForm product={product} isEdit />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Оновити товар" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Товар із таким SKU вже існує. Вкажіть інший артикул."
      )
    );
    expect(toast.error).not.toHaveBeenCalledWith("SKU already exists");
  });

  it("falls back to the generic save error for a code the catalog does not know", async () => {
    failSave({ error: "Boom", code: "SOMETHING_NEW" });
    renderWithIntl(<ProductForm product={product} isEdit />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Оновити товар" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Не вдалося зберегти товар"));
    expect(toast.error).not.toHaveBeenCalledWith("Boom");
  });
});

describe("ProductForm — client checks match the server's", () => {
  // The API rejects these with a field-less VALIDATION_ERROR; the form must
  // catch them first, under the right field, before any request goes out.
  const submitEdit = async (label: string, value: string) => {
    renderWithIntl(<ProductForm product={product} isEdit />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled()); // categories loaded
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Оновити товар" }));
  };
  const sentPut = () => fetchMock.mock.calls.some(([, init]) => init?.method === "PUT");

  it.each([
    ["Ціна *", "0", "Ціна має бути додатним числом"],
    ["Собівартість", "0", "Собівартість має бути додатним числом"],
    ["GTIN / Штрихкод", "123456789012345", "Штрихкод — не довше 14 символів"],
    ["Бренд", "x".repeat(71), "Бренд — не довше 70 символів"],
    ["MPN", "x".repeat(71), "MPN — не довше 70 символів"],
  ])("«%s» = %j is stopped in the form with «%s»", async (label, value, message) => {
    await submitEdit(label, value);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(sentPut()).toBe(false);
  });
});
