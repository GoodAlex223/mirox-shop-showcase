import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output:
    "coverage/**",
    // Third-party exports, not project source (Figma-generated vendor JS in the
    // design handoff). Flat config makes `eslint .` lint .js too — the lint
    // script's `--ext .ts,.tsx` no longer restricts anything under ESLint v9.
    "docs/**",
  ]),
]);

export default eslintConfig;
