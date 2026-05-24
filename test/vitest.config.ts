import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    root:        path.resolve(__dirname, ".."),
    include:     [
      "test/**/*.test.ts",
      "test/unit/**/*.test.ts",
      "test/integration/**/*.test.ts",
      "test/runtime/**/*.test.ts",
      "test/orchestration/**/*.test.ts",
      "test/parallel/**/*.test.ts",
      "test/recovery/**/*.test.ts",
      "test/telemetry/**/*.test.ts",
      "test/memory/**/*.test.ts",
      "test/security/**/*.test.ts",
      "test/preview/**/*.test.ts",
      "test/replay/**/*.test.ts",
    ],
    environment:    "node",
    globals:        true,
    clearMocks:     true,
    restoreMocks:   true,
    testTimeout:    15_000,
    hookTimeout:    10_000,
    sequence: {
      shuffle: false,   // deterministic ordering
    },
    coverage: {
      provider:    "v8",
      include:     ["server/**/*.ts"],
      exclude:     [
        "server/**/*.d.ts",
        "server/**/__tests__/**",
        "test/**",
        "server/replit_integrations/**",
      ],
      reporter:    ["text", "json", "html", "lcov"],
      thresholds: {
        lines:       70,
        functions:   70,
        branches:    65,
        statements:  70,
      },
    },
    reporters: ["verbose", "json"],
    outputFile: "test/results/vitest-results.json",
  },
  resolve: {
    alias: {
      "@shared":  path.resolve(__dirname, "../shared"),
      "@server":  path.resolve(__dirname, "../server"),
      "@test":    path.resolve(__dirname, "."),
    },
    extensions: [".ts", ".tsx", ".js"],
  },
});
