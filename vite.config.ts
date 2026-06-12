import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  // Relative base so the app works on GitHub Pages under any repo name.
  base: "./",
  plugins: [vue()],
  server: {
    // Honor the port assigned by the preview harness, if any.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
});
