import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/", // absolute asset paths, so deep links like /students/STU-1 load their scripts
  // During development, forward API calls to the local API server (npm run dev:api).
  server: { proxy: { "/api": "http://localhost:3001" } },
});
