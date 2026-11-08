/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  // Relative assets so a future static host can serve this folder
  // from a subpath without rewriting the live site root.
  base: "./",
  server: {
    fs: {
      allow: [".."],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
