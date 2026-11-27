import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const APP_ENV = ["PUBLIC_URL", "REACT_APP_API_URL", "REACT_APP_MUSEE_ENABLED", "REACT_APP_MUSEE_VERSION", "REACT_APP_URL_BACK"];

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // App code reads process.env. Tests set it at runtime, so it stays real there.
  define: process.env.VITEST ? {} : {
    ...Object.fromEntries(APP_ENV.map(name => [`process.env.${name}`, JSON.stringify(process.env[name] ?? "")])),
    "process.env.NODE_ENV": JSON.stringify(mode),
  },
  // Keeps the go and rezo logs readable: these styles predate the Sass deprecations.
  css: { preprocessorOptions: { scss: { silenceDeprecations: ["color-functions", "global-builtin", "import", "mixed-decls"] } } },
  build: { outDir: "build", assetsDir: "static", sourcemap: true, chunkSizeWarningLimit: 2000 },
  // Keep the dependency scan away from the HTML pages under public/.
  optimizeDeps: { entries: ["index.html"] },
  // The backend only accepts this origin (CORS).
  server: { port: 3000, strictPort: true, host: true, allowedHosts: true, proxy: { "/api": "http://localhost:3001" } },
  test: {
    globals: true, environment: "jsdom", setupFiles: "./src/setupTests.js", css: false,
    include: ["src/**/*.test.{js,jsx}"], mockReset: true, env: { PUBLIC_URL: "" },
  },
}));
