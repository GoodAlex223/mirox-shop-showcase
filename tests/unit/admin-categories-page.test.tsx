import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import AdminCategoriesPage from "@/app/(admin)/admin/categories/page";

// The row menu (Radix DropdownMenu) and the parent picker (Radix Select) need
// browser APIs jsdom lacks. Scoped here, as in product-form.test.tsx.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

const svetry = {
  id: "c1",
  name: "Светри",
  slug: "svetry",
  description: null,
  image: null,
  isActive: true,
  sortOrder: 0,
  parentId: null,
  parent: null,
  _count: { products: 0, children: 0 },
};

const fetchMock = vi.fn();

/** Answers the page's two list reads; `write` answers the create/update call. */
function serve(write: { ok: boolean; body: unknown } = { ok: true, body: { id: "new" } }) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" || init?.method === "PUT") {
      return { ok: write.ok, json: async () => write.body };
    }
    if (url.includes("all=true")) {
      return { ok: true, json: async () => [svetry] };
    }
    return {
      ok: true,
      json: async () => ({
        data: [svetry],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  serve();
});
afterEach(() => vi.unstubAllGlobals());

const nameField = () => screen.getByLabelText("Назва *");
const slugField = () => screen.getByLabelText("Slug");

/** One change event per keystroke, as typing produces. */
function typeName(value: string) {
  for (let i = 1; i <= value.length; i++) {
    fireEvent.change(nameField(), { target: { value: value.slice(0, i) } });
  }
}

async function openCreateDialog() {
  renderWithIntl(<AdminCategoriesPage />);
  await screen.findByText("/svetry");
  fireEvent.click(screen.getByRole("button", { name: "Додати категорію" }));
}

const writeBody = () => {
  const call = fetchMock.mock.calls.find(
    ([, init]) => init?.method === "POST" || init?.method === "PUT"
  );
  return JSON.parse(call![1].body as string);
};

describe("category dialog — the slug follows the name", () => {
  it("fills the whole transliterated name, not the first keystroke's slug", async () => {
    await openCreateDialog();
    typeName("Худі");
    expect(slugField()).toHaveValue("khudi");
    typeName("Худі оверсайз");
    expect(slugField()).toHaveValue("khudi-oversaiz");
  });

  it("stops following the name once the slug field is edited by hand", async () => {
    await openCreateDialog();
    typeName("Худі");
    fireEvent.change(slugField(), { target: { value: "my-slug" } });
    typeName("Худі оверсайз");
    expect(slugField()).toHaveValue("my-slug");
  });

  it("never re-derives an existing category's slug when it is renamed", async () => {
    renderWithIntl(<AdminCategoriesPage />);
    const row = (await screen.findByText("/svetry")).closest("tr")!;
    fireEvent.keyDown(within(row).getByRole("button"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Редагувати" }));

    expect(slugField()).toHaveValue("svetry");
    typeName("Худі");
    expect(slugField()).toHaveValue("svetry");
  });
});

describe("category dialog — what it submits", () => {
  it("sends a blank image as null, which the schema accepts", async () => {
    await openCreateDialog();
    typeName("Светри");
    fireEvent.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(writeBody()).toEqual(expect.objectContaining({ image: null })));
    expect(writeBody().slug).toBe("svetry");
  });
});

describe("category dialog — errors", () => {
  it("shows the Ukrainian copy for the API's code — never its English error", async () => {
    serve({ ok: false, body: { error: "Parent category not found", code: "PARENT_NOT_FOUND" } });
    await openCreateDialog();
    typeName("Светри");
    fireEvent.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Батьківську категорію не знайдено. Оновіть сторінку й оберіть іншу."
      )
    );
    expect(toast.error).not.toHaveBeenCalledWith("Parent category not found");
  });

  it("falls back to the generic save error for a code the catalog does not know", async () => {
    serve({ ok: false, body: { error: "Boom", code: "SOMETHING_NEW" } });
    await openCreateDialog();
    typeName("Светри");
    fireEvent.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Не вдалося зберегти категорію"));
    expect(toast.error).not.toHaveBeenCalledWith("Boom");
  });
});
