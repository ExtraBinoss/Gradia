import { it, expect } from "vitest";
import { parseConfig, deserializeConfig } from "@plinka/gradient-core";
import { codeSnippet, agentPrompt } from "./export";
const config = parseConfig({
  seed: 9183,
  speed: 7,
  style: "silk",
  effect: "ascii",
  loopDuration: 13,
  twist: 1.4,
  asciiCharacters: " .01#",
});
it("exports the entire current configuration in React, JS and JSON without mutating it", () => {
  expect(deserializeConfig(codeSnippet(config, "json"))).toEqual(config);
  for (const distribution of ["source", "minified"] as const) {
    const react = codeSnippet(config, "react", distribution),
      js = codeSnippet(config, "javascript", distribution);
    expect(JSON.parse(react.match(/const config: GradientConfig = ([\s\S]*?);\n/)![1])).toEqual(
      config,
    );
    expect(JSON.parse(js.match(/const config = ([\s\S]*?);\n/)![1])).toEqual(config);
    expect(react).toContain("height: '100dvh'");
    expect(js).not.toContain("gradient.update(");
    expect(js).toContain("window.addEventListener('pagehide'");
    expect(react).toContain(
      distribution === "source" ? "./gradient/react" : "./gradia/min-js/gradia-react.min.js",
    );
  }
});
it("the copied agent prompt includes the exact user preset and integration instructions", () => {
  const prompt = agentPrompt(config);
  expect(prompt).toContain('"seed": 9183');
  expect(prompt).toContain('"asciiCharacters": " .01#"');
  expect(prompt).toContain("docs/agents.md");
  expect(prompt).toContain("Do not recreate the renderer per frame");
  expect(agentPrompt(config, "source")).toContain("Copy gradient/core");
  const local = agentPrompt(config, "minified", "http://localhost:8410");
  expect(local).toContain("http://localhost:8410/gradia-kit.zip");
  expect(local).toContain("http://localhost:8410/docs/agents.md");
  expect(local).toContain("this exact app instance");
});
