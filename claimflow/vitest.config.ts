import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "e2e", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "e2e/",
        ".next/",
        "mcp/",
        "prisma/",
        "**/*.config.*",
        // UI page components (presentation layer, no business logic)
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/page.tsx",
        "src/app/layout.tsx",
        // UI components (pure display)
        "src/components/**/*.tsx",
        // Type definitions only
        "src/types/**",
        // Scripts
        "scripts/**",
        // Auth config (tested indirectly via API tests)
        "src/auth.ts",
        "src/middleware.ts",
        // Prompt templates (no logic)
        "src/lib/prompts/**",
        // check-pwd utility script
        "check-pwd.js",
        "next-env.d.ts",
      ],
      thresholds: {
        global: {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
