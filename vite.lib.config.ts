import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "dist-lib",
    lib: {
      entry: {
        core: "packages/core/src/index.ts",
        webgl: "packages/webgl/src/index.ts",
        react: "packages/react/src/index.tsx",
      },
      formats: ["es"],
    },
    rollupOptions: { external: ["react", "react/jsx-runtime"] },
    minify: true,
  },
});
