import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        setup: resolve(__dirname, "setup/index.html"),
        today: resolve(__dirname, "today/index.html"),
        calendar: resolve(__dirname, "calendar/index.html"),
        commitments: resolve(__dirname, "commitments/index.html"),
        search: resolve(__dirname, "search/index.html"),
        areas: resolve(__dirname, "areas/index.html"),
        systems: resolve(__dirname, "systems/index.html"),
        projects: resolve(__dirname, "projects/index.html"),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
