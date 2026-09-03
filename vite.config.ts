import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tauri 2 约定：固定端口 + 清屏关闭（交给 Tauri CLI 管理）
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 避免监听构建产物导致 EBUSY（tauri dev 编译时占用 exe）
      ignored: ["**/src-tauri/target/**", "**/node_modules/**", "**/dist/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2021",
    minify: false,
    sourcemap: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});