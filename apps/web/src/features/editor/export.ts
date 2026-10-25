import { parseConfig, serializeConfig, type GradientConfig } from "@plinka/gradient-core";
import { GradientRenderer } from "@plinka/gradient-webgl";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadConfig(config: GradientConfig) {
  download(new Blob([serializeConfig(config)], { type: "application/json" }), "gradient.json");
}
export async function exportPng(
  config: GradientConfig,
  time: number,
  width: number,
  height: number,
) {
  const canvas = document.createElement("canvas");
  const renderer = new GradientRenderer(canvas, {
    config,
    playing: false,
    width,
    height,
    pixelRatio: 1,
    maxPixels: width * height,
  });
  try {
    renderer.seek(time);
    const blob = await renderer.snapshot();
    download(blob, `gradient-${width}x${height}.png`);
  } finally {
    renderer.destroy();
    canvas.getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
export type CodeFormat = "react" | "javascript" | "json";
export type CodeDistribution = "source" | "minified";
export function codeSnippet(
  config: GradientConfig,
  format: CodeFormat,
  distribution: CodeDistribution = "source",
) {
  if (format === "json") return serializeConfig(config);
  const data = JSON.stringify(parseConfig(config), null, 2);
  const engine = distribution === "source" ? "./gradient/webgl" : "./gradia/min-js/gradia.min.js";
  const react =
    distribution === "source" ? "./gradient/react" : "./gradia/min-js/gradia-react.min.js";
  const core = distribution === "source" ? "./gradient/core" : "./gradia/min-js/gradia.min.js";
  if (format === "javascript")
    return `import { GradientRenderer } from '${engine}';\n\nconst config = ${data};\n\nconst canvas = document.createElement('canvas');\ncanvas.style.cssText = 'display:block;width:100%;height:100dvh';\ndocument.body.appendChild(canvas);\n\nconst gradient = new GradientRenderer(canvas, { config });\n\n// Keep the renderer alive. Clean up when this page is disposed.\nwindow.addEventListener('pagehide', () => {\n  gradient.destroy();\n  canvas.remove();\n}, { once: true });`;
  return `'use client';\n\nimport { Gradient } from '${react}';\nimport type { GradientConfig } from '${core}';\n\nconst config: GradientConfig = ${data};\n\nexport function GradiaBackground() {\n  return (\n    <Gradient\n      config={config}\n      style={{ width: '100%', height: '100dvh', display: 'block' }}\n      aria-label="Animated Gradia gradient"\n    />\n  );\n}`;
}
export function agentPrompt(config: GradientConfig, distribution: CodeDistribution = "minified") {
  return `Integrate Gradia into this project using the EXACT configuration below.\n\nRead https://gradia.plinka.eu/docs/agents.md and https://github.com/ExtraBinoss/Gradia first.\nDownload https://gradia.plinka.eu/gradia-kit.zip. ${distribution === "minified" ? "Copy the gradia/ folder. For plain JS, gradia/min-js/gradia.min.js is a dependency-free ESM module. For React, use gradia/min-js/gradia-react.min.js; React is the only peer dependency." : "Copy gradient/core, gradient/webgl and gradient/react from the source kit. Keep the engine separate from the UI."}\n\nFor React, use <Gradient config={config} /> inside a container with explicit dimensions. For JS, create one GradientRenderer(canvas, { config }) and destroy it only on teardown. Use update(patch) for continuous controls and transitionTo(config, 0.65) for discrete changes. Do not recreate the renderer per frame. Do not change this preset's parameters or add auto-running example updates. Keep animation outside React state, respect reduced motion, and verify the actual canvas renders.\n\n${serializeConfig(config)}`;
}

export async function share(config: GradientConfig) {
  const url = new URL(location.href);
  url.hash = `config=${encodeURIComponent(serializeConfig(config))}`;
  await navigator.clipboard.writeText(url.toString());
}
