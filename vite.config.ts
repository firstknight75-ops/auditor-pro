import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    importProtection: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      // Force the Node entry of @libsql/client so file: URLs work in
      // the dev/SSR runtime (the default workerd condition resolves to
      // the web client, which only supports libsql:/http(s):/ws(s): URLs).
      "@libsql/client": "@libsql/client/node",
    },
  },
});
