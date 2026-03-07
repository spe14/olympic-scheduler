import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/**/*.ts"],
      exclude: [
        "lib/db/**",
        "lib/supabase/**",
        "lib/constants.ts",
        "lib/types.ts",
        "lib/utils.ts",
      ],
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
