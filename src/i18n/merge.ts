// `readonly MessageValue[]` covers structured catalog content such as
// `pages.*.sections` (G23) — an array of { heading, body[], list? } objects —
// which plain string/nested-object messages never needed before.
//
// `undefined` is there for the OPTIONAL member of such an object: TypeScript
// infers `list?: undefined` on the sections that carry no list, and a property
// typed `undefined` blocks the implicit index signature that makes the element
// assignable to MessageTree. It is a type-level allowance for an absent key,
// never a value deepMerge writes.
type MessageValue = string | MessageTree | readonly MessageValue[] | undefined;
type MessageTree = { [key: string]: MessageValue };

// Explicit type predicate: arrays are treated as leaf values (never merged
// element-by-element), so this must reject them even though `Array.isArray`
// narrowing on a recursive union isn't reliably picked up by the checker.
function isMessageTree(value: MessageValue): value is MessageTree {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * RU-over-UA message merge (spec §1): a missing or shape-mismatched RU key
 * silently keeps the UA value, so partial RU coverage never breaks the UI.
 */
export function deepMerge<T extends MessageTree>(base: T, override: MessageTree): T {
  const out: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    if (typeof value === "string" && typeof current === "string") {
      out[key] = value;
    } else if (isMessageTree(value) && isMessageTree(current)) {
      out[key] = deepMerge(current, value);
    } else if (Array.isArray(value) && Array.isArray(current)) {
      // Arrays are leaf values, not merged element-by-element — a matching
      // pair replaces wholesale, the same way a matching pair of strings does.
      out[key] = value;
    }
    // shape mismatch (e.g. array over string/object, or vice versa) or key
    // absent in base: keep base (uk is the schema)
  }
  return out as T;
}
