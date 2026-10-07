import { describe, it, expect } from "vitest";
import { diffImages, type AdminImage } from "@/components/admin/image-diff";

const a: AdminImage = { id: "a", url: "https://x/a.jpg" };
const b: AdminImage = { id: "b", url: "https://x/b.jpg" };
const fresh: AdminImage = { url: "https://x/new.jpg", isNew: true };

describe("diffImages", () => {
  it("reports a new (id-less) image as added", () => {
    expect(diffImages([a, b], [a, b, fresh])).toEqual({
      added: [fresh],
      removedIds: [],
      orderChanged: false,
    });
  });

  it("reports a missing persisted id as removed", () => {
    expect(diffImages([a, b], [b])).toEqual({ added: [], removedIds: ["a"], orderChanged: false });
  });

  it("reports a pure reorder of persisted ids", () => {
    expect(diffImages([a, b], [b, a])).toEqual({ added: [], removedIds: [], orderChanged: true });
  });

  it("does not count an add or remove as a reorder", () => {
    expect(diffImages([a, b], [b, fresh]).orderChanged).toBe(false);
  });

  it("is a no-op for identical lists", () => {
    expect(diffImages([a, b], [a, b])).toEqual({ added: [], removedIds: [], orderChanged: false });
  });
});
