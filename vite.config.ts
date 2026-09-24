import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // Relative base so the build works inside Tauri webview and static deployments
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  worker: { format: "es" },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "es2022",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
