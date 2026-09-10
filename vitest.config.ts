import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Deliberately NOT `getViteConfig` from "astro/config": that pulls in the Cloudflare adapter,
// which switches Vitest to a workerd pool and fails at startup with "exports is not defined".
// These are pure-function tests -- no Astro globals, no Supabase client, no fetch -- so a
// plain Node environment is the right one. The `@/*` alias is repeated here because of that;
// keep it in step with astro.config.mjs and tsconfig.json.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
