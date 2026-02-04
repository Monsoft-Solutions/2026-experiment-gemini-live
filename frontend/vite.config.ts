import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/ws": {
        target: "http://localhost:5174",
        ws: true,
      },
      "/config": "http://localhost:5174",
      "/convex-url": "http://localhost:5174",
      "/twilio": "http://localhost:5174",
    },
  },
});
