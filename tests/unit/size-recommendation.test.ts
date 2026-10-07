import { describe, it, expect } from "vitest";
import { recommendSize } from "@/lib/size-recommendation";

// Placeholder formula per spec/AC (client size charts pending; TASK-045 replaces):
// XXL h≥190‖w≥95 · XL h≥184‖w≥85 · L h≥176‖w≥72 · M h≥168‖w≥60 · else S
describe("recommendSize", () => {
  it.each([
    [190, 50, "XXL"],
    [150, 95, "XXL"],
    [189, 94, "XL"],
    [184, 40, "XL"],
    [150, 85, "XL"],
    [183, 84, "L"],
    [176, 40, "L"],
    [150, 72, "L"],
    [175, 71, "M"],
    [168, 40, "M"],
    [150, 60, "M"],
    [167, 59, "S"],
    [100, 30, "S"],
    [180, 75, "L"],
  ] as const)("h=%i w=%i → %s", (h, w, expected) => {
    expect(recommendSize(h, w)).toBe(expected);
  });
});
