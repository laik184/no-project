import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    root:        path.resolve(__dirname, ".."),
    include:     ["test/**/*.test.ts"],
    environment: "node",
    globals:     true,
    clearMocks:  true,
    coverage: {
      provider: "v8",
      include:  ["server/**/*.ts"],
      exclude:  ["server/**/*.d.ts", "test/**"],
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
    extensions: [".ts", ".tsx", ".js"],
  },
});
