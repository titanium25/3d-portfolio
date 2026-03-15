import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: ".",
  base: "/explore/",
  server: {
    port: 5174,
  },
  build: {
    outDir: "../../dist/explore",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../../shared"),
    },
  },
});
