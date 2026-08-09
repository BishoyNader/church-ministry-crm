import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Unit/service tests run in Node. Component tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock at the top of the test file.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", ".next/**", "backups/**"],
    setupFiles: ["tests/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      include: [
        "src/features/**/services/**",
        "src/features/**/schemas/**",
        "src/features/rbac/**",
        "src/lib/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
