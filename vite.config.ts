import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  // Relative base so the app works on GitHub Pages under any repo name.
  base: "./",
  plugins: [vue()],
});
