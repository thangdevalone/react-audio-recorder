import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      "react-audio-recorder-lite": new URL("../..", import.meta.url).pathname
    }
  }
});

