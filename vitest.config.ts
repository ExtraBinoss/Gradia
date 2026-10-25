import { defineConfig } from "vitest/config";
const minimum = { lines: 85, statements: 85, functions: 85, branches: 85 };
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: { ...minimum, "packages/core/src/**": minimum },
    },
  },
});
