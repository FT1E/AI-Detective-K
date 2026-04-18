import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viewerViteDevFixPlugin } from "@luxonis/depthai-viewer-common/vite";

export default defineConfig({
  plugins: [react(), viewerViteDevFixPlugin()],
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
