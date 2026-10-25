import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
const directory = await mkdtemp(resolve(".gradia-consumer-"));
try {
  const file = join(directory, "consumer.tsx");
  await writeFile(
    file,
    `import { GradientRenderer,parseConfig,type GradientConfig } from '../package/min-js/gradia.min.js';\nimport { Gradient } from '../package/min-js/gradia-react.min.js';\nconst config:GradientConfig=parseConfig({style:'silk'});\nexport const component=<Gradient config={config} style={{height:400}}/>;\nexport const mount=(canvas:HTMLCanvasElement)=>new GradientRenderer(canvas,{config});\n`,
  );
  execFileSync(
    "bunx",
    [
      "--no-install",
      "tsc",
      "--noEmit",
      "--jsx",
      "react-jsx",
      "--module",
      "esnext",
      "--moduleResolution",
      "bundler",
      "--target",
      "es2022",
      "--skipLibCheck",
      file,
    ],
    { stdio: "inherit" },
  );
  const core = await import(pathToFileURL(resolve("package/min-js/gradia.min.js")).href);
  const react = await import(pathToFileURL(resolve("package/min-js/gradia-react.min.js")).href);
  if (
    !renderToString(createElement(react.Gradient, { config: core.DEFAULT_CONFIG })).includes(
      "<canvas",
    )
  )
    throw new Error("React adapter SSR import failed");
  if (/from["'](?:react|@plinka)/.test(await readFile("package/min-js/gradia.min.js", "utf8")))
    throw new Error("Standalone engine has unresolved imports");
  console.log("Portable Gradia modules: TypeScript consumer and React SSR verified.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
