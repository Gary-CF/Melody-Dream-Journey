import { defineConfig, loadEnv } from "vite";
import { narrativePlugin } from "./server/narrative-service.mjs";
import { reviewPlugin } from "./server/review-service.mjs";
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [reviewPlugin(), narrativePlugin(loadEnv(mode, process.cwd(), ""))],
  build: {
    rollupOptions: {
      input: { main: "index.html", lab: "asset-lab.html" },
      output: { manualChunks: { three: ["three"] } },
    },
  },
}));
