import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/", // absolute asset paths, so deep links like /students/STU-1 load their scripts
  // During development, forward API calls to the local API server (npm run dev:api).
  // changeOrigin stays false so the API sees the page's own host and its same-site check passes.
  server: { proxy: { "/api": { target: "http://localhost:3001", changeOrigin: false } } },
});
