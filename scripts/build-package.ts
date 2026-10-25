import { build } from "vite";
import { mkdir, readdir, readFile, writeFile, cp } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
await build({
  configFile: false,
  build: {
    outDir: "package/min-js",
    emptyOutDir: true,
    lib: {
      entry: "packages/webgl/src/standalone.ts",
      formats: ["es"],
      fileName: () => "gradia.min.js",
    },
    rollupOptions: { output: { codeSplitting: false } },
    minify: true,
  },
});
await build({
  configFile: false,
  build: {
    outDir: "package/min-js",
    emptyOutDir: false,
    lib: {
      entry: "packages/react/src/index.tsx",
      formats: ["es"],
      fileName: () => "gradia-react.min.js",
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "@plinka/gradient-core", "@plinka/gradient-webgl"],
      output: {
        paths: {
          "@plinka/gradient-core": "./gradia.min.js",
          "@plinka/gradient-webgl": "./gradia.min.js",
        },
        codeSplitting: false,
      },
    },
    minify: true,
  },
});
execFileSync("bun", ["x", "tsc", "-p", "tsconfig.package.json"], { stdio: "inherit" });
async function rewrite(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await rewrite(file);
    else if (entry.name.endsWith(".d.ts")) {
      const source = await readFile(file, "utf8");
      await writeFile(
        file,
        source
          .replaceAll("@plinka/gradient-core", "../../core/src/index")
          .replaceAll("@plinka/gradient-webgl", "../../webgl/src/index"),
      );
    }
  }
}
await rewrite("package/types");
await writeFile(
  "package/types/index.d.ts",
  'export * from "./core/src/index";\nexport * from "./webgl/src/index";\n',
);
await writeFile("package/types/react.d.ts", 'export * from "./react/src/index";\n');
await writeFile("package/min-js/gradia.min.d.ts", 'export * from "../types/index";\n');
await writeFile("package/min-js/gradia-react.min.d.ts", 'export * from "../types/react";\n');
await mkdir("apps/web/public/lib", { recursive: true });
await cp("package/min-js", "apps/web/public/lib", { recursive: true });
await cp("package/types", "apps/web/public/types", { recursive: true });
console.log("Gradia standalone ESM and TypeScript declarations built.");
