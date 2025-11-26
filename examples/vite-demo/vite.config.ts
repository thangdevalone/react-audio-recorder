import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const librarySource = fileURLToPath(new URL("../../src", import.meta.url));

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]]
      }
    })
  ],
  resolve: {
    alias: {
      "react-audio-recorder-lite": librarySource
    }
  },
  server: {
    port: 5173
  }
});
