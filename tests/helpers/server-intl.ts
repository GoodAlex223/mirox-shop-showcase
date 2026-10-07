import { vi } from "vitest";
import uk from "../../messages/uk.json";

function getPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object" && part in (acc as Record<string, unknown>)
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      obj
    );
}

/**
 * Mock `next-intl/server` with a real lookup into messages/uk.json.
 *
 * Vitest has no request scope, and next-intl 4.13.6's server entry expects the
 * "react-server" condition, which is absent here — so `getTranslations` has to
 * be mocked. Backing it with the real catalog (rather than a hand-written
 * fixture) means a page test fails when the catalog key is missing or
 * misspelled, which is the whole point.
 *
 * Call at module scope, BEFORE importing the component under test — vi.mock is
 * hoisted, and this wraps it.
 *
 * The call looks like a no-op because Vitest hoists the `vi.mock` out of this
 * function body — but the call is what anchors the import of this module, and
 * TS import-elision drops an import whose only binding is never used, taking
 * the mock with it. Do not remove the call.
 */
export function mockServerIntl() {
  vi.mock("next-intl/server", () => ({
    getTranslations: async (namespace?: string) => {
      const scope = namespace ? getPath(uk, namespace) : uk;
      const t = (key: string, params?: Record<string, string>) => {
        const raw = getPath(scope, key);
        if (typeof raw !== "string") {
          throw new Error(
            `server-intl mock: "${namespace ? namespace + "." : ""}${key}" is missing from messages/uk.json (or is not a string)`
          );
        }
        return params
          ? Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), raw)
          : raw;
      };
      t.raw = (key: string) => getPath(scope, key);
      t.has = (key: string) => getPath(scope, key) !== undefined;
      return t;
    },
  }));
}
