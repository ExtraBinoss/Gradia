import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse, type ParseError } from "jsonc-parser";
const env = process.env;
if (
  env.GITHUB_REPOSITORY !== "ExtraBinoss/Gradia" ||
  env.GITHUB_ACTOR !== "ExtraBinoss" ||
  env.GITHUB_TRIGGERING_ACTOR !== "ExtraBinoss" ||
  env.GITHUB_REF !== "refs/heads/main" ||
  !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || "")
)
  throw new Error("Production is restricted to ExtraBinoss on ExtraBinoss/Gradia main.");
for (const file of ["wrangler.jsonc", "wrangler.ci.jsonc"]) {
  const errors: ParseError[] = [];
  const config = parse(readFileSync(file, "utf8"), errors, { allowTrailingComma: true });
  if (errors.length) throw new Error(`Invalid deployment configuration: ${file}`);
  if (
    config.name !== "gradia" ||
    config.assets.directory !== "./dist" ||
    config.account_id !== "ea4303bc13e34c8659069749d9cdca53"
  )
    throw new Error("Unexpected Cloudflare deployment target.");
}
// Version operations preserve the existing Custom Domain and need no zone-wide route edit token.
execFileSync(
  "bunx",
  [
    "--no-install",
    "wrangler",
    "versions",
    "upload",
    "--config",
    "wrangler.ci.jsonc",
    "--tag",
    env.GITHUB_SHA!,
    "--message",
    `GitHub ${env.GITHUB_SHA}`,
  ],
  { stdio: "inherit" },
);
execFileSync(
  "bunx",
  [
    "--no-install",
    "wrangler",
    "versions",
    "deploy",
    "--config",
    "wrangler.ci.jsonc",
    "--version-tag",
    env.GITHUB_SHA!,
    "--percentage",
    "100",
    "--yes",
  ],
  { stdio: "inherit" },
);
