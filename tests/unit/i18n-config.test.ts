import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, resolveLocale } from "@/i18n/config";
import { deepMerge } from "@/i18n/merge";

describe("resolveLocale", () => {
  it("returns uk for undefined (no cookie)", () => {
    expect(resolveLocale(undefined)).toBe("uk");
  });
  it("returns uk for garbage values", () => {
    expect(resolveLocale("en")).toBe("uk");
    expect(resolveLocale("uk-UA")).toBe("uk");
    expect(resolveLocale("")).toBe("uk");
  });
  it("returns each supported locale verbatim", () => {
    for (const l of LOCALES) expect(resolveLocale(l)).toBe(l);
  });
  it("defaults to uk", () => {
    expect(DEFAULT_LOCALE).toBe("uk");
  });
});

describe("deepMerge", () => {
  it("overrides scalars and recurses into nested objects", () => {
    const base = { a: { b: "укр", c: "спільне" }, d: "базове" };
    const override = { a: { b: "рус" } };
    expect(deepMerge(base, override)).toEqual({
      a: { b: "рус", c: "спільне" },
      d: "базове",
    });
  });
  it("does not mutate its inputs", () => {
    const base = { a: { b: "x" } };
    const override = { a: { b: "y" } };
    deepMerge(base, override);
    expect(base.a.b).toBe("x");
  });
  it("ignores override keys that are objects where base has strings (shape mismatch keeps base)", () => {
    const base = { a: "текст" };
    const override = { a: { broken: "shape" } } as unknown as typeof base;
    expect(deepMerge(base, override)).toEqual({ a: "текст" });
  });
});
