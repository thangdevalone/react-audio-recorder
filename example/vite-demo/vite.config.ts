import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(__dirname),
  server: {
    port: 5173,
    allowedHosts:["fe-vite.modern-ui.org"]
  },
  optimizeDeps: {
    include: ["react-ts-audio-recorder"],
    force: true,
  },
});
