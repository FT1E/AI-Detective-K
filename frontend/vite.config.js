import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// OAK viewer plugin is optional — skip if not installed
let oakPlugin = null;
try {
  const oak = await import("@luxonis/depthai-viewer-common/vite");
  oakPlugin = oak.viewerViteDevFixPlugin();
} catch {}

export default defineConfig({
  plugins: [react(), oakPlugin].filter(Boolean),
  build: {
    target: "esnext",
    rollupOptions: {
      // Don't bundle the huge OAK package — it's loaded dynamically at runtime
      external: [
        "@luxonis/depthai-viewer-common",
        "@luxonis/depthai-viewer-common/styles",
        "@luxonis/depthai-viewer-common/vite",
      ],
    },
  },
  server: {
    port: 5000,
    proxy: {
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
      "/api": {
        target: "http://localhost:8000",
      },
    },
  },
});
