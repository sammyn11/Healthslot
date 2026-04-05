import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  /** .env in client/ is not always on process.env when this file runs — load explicitly */
  const env = loadEnv(mode, __dirname, "");
  const API_PORT = env.VITE_DEV_API_PORT ?? "4000";
  const API_TARGET = `http://127.0.0.1:${API_PORT}`;

  return {
    plugins: [react()],
    server: {
      /** Listen on all interfaces so http://127.0.0.1:5173 works (default localhost can be IPv6-only). */
      host: true,
      port: 5173,
      open: true,
      proxy: {
        "/api": {
          target: API_TARGET,
          changeOrigin: true,
          secure: false,
          configure(proxy) {
            proxy.on("error", (err) => {
              console.error("[Vite /api proxy →", API_TARGET, "]", err.message);
            });
          },
        },
      },
    },
  };
});
