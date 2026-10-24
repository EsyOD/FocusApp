import { defineConfig } from "vite";

// Tauri expects a fixed dev port and serves the built files from dist/.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    rollupOptions: {
      // The break overlay windows load their own page.
      input: { main: "index.html", overlay: "overlay.html" },
    },
  },
});
