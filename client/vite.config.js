import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // use root in development so hard refresh and direct links work
  // production build will still use /static/ where Flask serves files
  base: process.env.NODE_ENV === "production" ? "/static/" : "/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
