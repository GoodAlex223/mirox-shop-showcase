import { describe, it, expect } from "vitest";
import { deepMerge } from "@/i18n/merge";

/**
 * deepMerge is shared infrastructure (src/i18n/request.ts calls it on every
 * RU locale resolution). Arrays are treated as leaf values — never merged
 * element-by-element — but a MATCHING pair of arrays must still replace
 * wholesale, the same way a matching pair of strings does. A shape mismatch
 * (array over string/object, or vice versa) keeps the base (uk) value,
 * since uk is the schema.
 */
describe("deepMerge", () => {
  it("replaces a base array with an override array of the same shape (array-over-array)", () => {
    const base = { sections: ["a", "b"] };
    const override = { sections: ["c", "d", "e"] };
    expect(deepMerge(base, override)).toEqual({ sections: ["c", "d", "e"] });
  });

  it("keeps the base string when the override provides an array at the same key (array-over-string)", () => {
    const base = { title: "hello" };
    const override = { title: ["not", "a", "string"] };
    expect(deepMerge(base, override)).toEqual({ title: "hello" });
  });

  it("keeps the base array when the override provides a string at the same key (string-over-array)", () => {
    const base = { sections: ["a", "b"] };
    const override = { sections: "not-an-array" };
    expect(deepMerge(base, override)).toEqual({ sections: ["a", "b"] });
  });

  it("replaces a nested array inside a tree", () => {
    const base = { terms: { title: "Оферта", sections: ["1", "2"] } };
    const override = { terms: { sections: ["1", "2", "3"] } };
    expect(deepMerge(base, override)).toEqual({
      terms: { title: "Оферта", sections: ["1", "2", "3"] },
    });
  });
});
