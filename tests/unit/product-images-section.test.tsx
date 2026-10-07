import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithIntl } from "../helpers/render-with-intl";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { ProductImagesSection } from "@/components/admin/ProductImagesSection";

const fetchMock = vi.fn();
const rows = [
  {
    id: "i1",
    productId: "p1",
    url: "https://pub.r2.dev/products/1-front.jpg",
    alt: "Спереду",
    position: 0,
  },
  {
    id: "i2",
    productId: "p1",
    url: "https://pub.r2.dev/products/2-back.jpg",
    alt: "Ззаду",
    position: 1,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  // Method-aware: GET/PUT return the row list (matching the real routes' shape),
  // POST returns a single created row, DELETE returns a message body. None of
  // this affects the response *shape* assertions below, but a reorder test
  // needs to tell a PUT call apart from the others, which the old
  // method-blind mock (both branches returning the same thing) could not do.
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "DELETE") return { ok: true, json: async () => ({ message: "deleted" }) };
    if (method === "POST") return { ok: true, json: async () => rows[0] };
    return { ok: true, json: async () => rows };
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("ProductImagesSection", () => {
  it("loads the product's images into the uploader grid", async () => {
    renderWithIntl(<ProductImagesSection productId="p1" />);
    expect(await screen.findByAltText("Спереду")).toBeInTheDocument();
    expect(screen.getByAltText("Ззаду")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/products/p1/images");
  });

  it("removing a persisted image calls DELETE on its item route", async () => {
    renderWithIntl(<ProductImagesSection productId="p1" />);
    await screen.findByAltText("Ззаду");
    // ImageUploader's remove buttons are icon-only; the second one belongs to i2.
    // Filtering by className substring "destructive" is unreliable here: the
    // shadcn Button's UNCONDITIONAL base class already contains
    // "aria-invalid:border-destructive" etc. on every variant (see
    // src/components/ui/button.tsx), so a className check matches the grip
    // buttons too. `data-variant` is the attribute Button actually sets per
    // variant, so it isolates the real destructive-styled remove buttons.
    const removeButtons = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("data-variant") === "destructive");
    fireEvent.click(removeButtons[1]);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/products/p1/images/i2",
        expect.objectContaining({ method: "DELETE" })
      )
    );
    await waitFor(() => expect(screen.queryByAltText("Ззаду")).toBeNull());
  });

  it("hides the save-order button until the order is dirty", async () => {
    renderWithIntl(<ProductImagesSection productId="p1" />);
    await screen.findByAltText("Ззаду");
    expect(screen.queryByRole("button", { name: "Зберегти порядок" })).toBeNull();
  });

  it("applies a drag reorder locally without a PUT, then persists it only on explicit save", async () => {
    renderWithIntl(<ProductImagesSection productId="p1" />);
    const frontImage = await screen.findByAltText("Спереду");
    const backImage = screen.getByAltText("Ззаду");
    // ImageUploader's reorder handlers (onDragStart/onDragOver/onDragEnd) are
    // plain, DataTransfer-free handlers on the draggable tile div wrapping
    // each image — fireEvent can drive them directly without simulating a
    // real HTML5 drag.
    const frontTile = frontImage.closest('[draggable="true"]') as HTMLElement;
    const backTile = backImage.closest('[draggable="true"]') as HTMLElement;
    expect(frontTile).not.toBeNull();
    expect(backTile).not.toBeNull();

    fireEvent.dragStart(frontTile);
    fireEvent.dragOver(backTile);
    fireEvent.dragEnd(frontTile);

    // The reorder must apply locally and NOT hit the network yet — this is
    // the entire reason this wrapper exists (ImageUploader fires onChange on
    // every dragover, so a naive wrapper would spam PUTs).
    const saveOrderButton = await screen.findByRole("button", { name: "Зберегти порядок" });
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PUT" })
    );

    fireEvent.click(saveOrderButton);

    // The dragged front tile (i1) was dropped onto the back tile (i2), so the
    // persisted order is now [i2, i1].
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/products/p1/images",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ imageIds: ["i2", "i1"] }),
        })
      )
    );
    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(putCalls).toHaveLength(1);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Зберегти порядок" })).toBeNull()
    );
  });

  // I1/G16 fix: `position: working.indexOf(item)` was an index into the
  // *currently visible* list, colliding with a surviving row's real
  // server-side position (e.g. remove image 0, upload a replacement —
  // indexOf gives 1, which i2 already occupies). The route's max+1 default
  // (only applied when `position` is absent) is the only collision-free
  // choice, so the POST body must never carry the field at all.
  it("uploading a new image posts no position — the route's max+1 default owns ordering", async () => {
    const uploadUrl = "https://signed.example/put";
    const publicUrl = "https://pub.r2.dev/products/999-new.jpg";
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/api/admin/upload" && method === "POST") {
        return {
          ok: true,
          json: async () => ({ uploadUrl, publicUrl, key: "products/999-new.jpg" }),
        };
      }
      if (url === uploadUrl && method === "PUT") {
        return { ok: true, json: async () => ({}) };
      }
      if (url === "/api/admin/products/p1/images" && method === "POST") {
        return { ok: true, json: async () => ({ id: "i3", url: publicUrl, alt: null }) };
      }
      if (method === "DELETE") return { ok: true, json: async () => ({ message: "deleted" }) };
      return { ok: true, json: async () => rows };
    });

    const { container } = renderWithIntl(<ProductImagesSection productId="p1" />);
    await screen.findByAltText("Ззаду");

    // Drive the same hidden file input react-dropzone's "click to browse"
    // path uses — the standard way to trigger its onDrop pipeline in jsdom
    // without simulating real HTML5 drag-and-drop DataTransfer events.
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake-image-bytes"], "new.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        ([u, i]) => u === "/api/admin/products/p1/images" && i?.method === "POST"
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall![1].body as string);
      expect(body).toEqual({ url: publicUrl });
      expect(body).not.toHaveProperty("position");
    });
  });
});
