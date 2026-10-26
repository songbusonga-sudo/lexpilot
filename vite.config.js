import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5267,
    strictPort: true,
    watch: { ignored: ['**/data/**', '**/artifacts/**', '**/.work/**', '**/output/**'] },
    proxy: { "/api": "http://127.0.0.1:8266" },
  },
});
