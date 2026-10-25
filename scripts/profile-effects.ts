import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const native = process.env.GRADIA_NATIVE_GPU === "1";
const browser = await chromium.launch(
  native
    ? {
        channel: "chrome",
        args: [
          "--enable-gpu",
          "--use-angle=vulkan",
          "--enable-features=Vulkan",
          "--ignore-gpu-blocklist",
        ],
      }
    : { args: ["--enable-unsafe-swiftshader"] },
);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:8411/");
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click();
    document.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')?.click();
  });
  const measurement = await page.evaluate(async () => {
    const core = "/lib/core.js",
      gpu = "/lib/webgl.js";
    const { createEffect, parseConfig } = await import(core);
    const { GradientRenderer } = await import(gpu);
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;z-index:1000;width:100vw;height:100vh";
    document.body.append(canvas);
    const samples: { fps: number; width: number; height: number; drawCalls: number }[] = [];
    const r = new GradientRenderer(canvas, {
      width: 1920,
      height: 1080,
      pixelRatio: 1,
      maxPixels: 2_000_000,
      playing: false,
      respectReducedMotion: false,
      onStats: (stats: { fps: number; width: number; height: number; drawCalls: number }) => {
        if (stats.fps) samples.push(stats);
      },
    });
    const gl = canvas.getContext("webgl")!,
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    const adapter = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    const phases = [];
    for (const effects of [
      [],
      [
        createEffect("blocks", "tiles"),
        createEffect("glass", "lens"),
        createEffect("dither", "print"),
      ],
    ]) {
      r.setPlaying(false);
      r.update(parseConfig({ effects, grain: 0.03 }));
      r.seek(0);
      gl.finish();
      samples.length = 0;
      r.setPlaying(true);
      await new Promise((resolve) => setTimeout(resolve, 4300));
      r.setPlaying(false);
      const stable = samples.slice(1),
        fps = stable.map((sample) => sample.fps).sort((a, b) => a - b);
      phases.push({
        effects: effects.map((effect: { type: string }) => effect.type),
        frames: stable,
        medianFps: fps[Math.floor(fps.length / 2)] ?? null,
      });
    }
    const error = gl.getError();
    r.destroy();
    canvas.remove();
    return {
      adapter,
      softwareGPU: /swiftshader|llvmpipe|software/i.test(adapter),
      maxPixels: 2_000_000,
      phases,
      error,
    };
  });
  const result = {
    measuredAt: new Date().toISOString(),
    scope:
      "One foreground 1920×1080 canvas capped to 2M pixels, after warmup. Observed frame pacing on this adapter; not a universal FPS guarantee or an isolated GPU timer.",
    ...measurement,
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/effects-runtime-performance.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
