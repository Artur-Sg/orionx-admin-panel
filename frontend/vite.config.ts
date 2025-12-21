import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "react";
          }
          if (id.includes("node_modules/react-router-dom/")) {
            return "router";
          }
          if (id.includes("node_modules/dayjs/")) {
            return "dayjs";
          }
          if (
            id.includes("node_modules/rc-") ||
            id.includes("node_modules/@rc-")
          ) {
            return "rc-components";
          }
          if (id.includes("node_modules/@ant-design/")) {
            return "ant-design";
          }
          if (id.includes("node_modules/@ctrl/")) {
            return "ctrl-utils";
          }
          if (id.includes("node_modules/antd/")) {
            return "antd";
          }
          if (id.includes("node_modules/@refinedev/antd/")) {
            return "refinedev-antd";
          }
          if (id.includes("node_modules/@refinedev/core/")) {
            return "refinedev-core";
          }
          if (id.includes("node_modules/@refinedev/react-router-v6/")) {
            return "refinedev-router";
          }
          if (id.includes("node_modules/@refinedev/simple-rest/")) {
            return "refinedev-data";
          }
          if (id.includes("node_modules/@refinedev/")) {
            return "refinedev-misc";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
