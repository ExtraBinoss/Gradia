import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://127.0.0.1:8411/");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const renderer = await page.evaluate(async () => {
    const url = "/lib/webgl.js";
    const { GradientRenderer } = await import(url);
    const c = document.createElement("canvas");
    const r = new GradientRenderer(c, { width: 256, height: 160, playing: false });
    const gl = c.getContext("webgl")!;
    let draws = 0;
    const original = gl.drawArrays.bind(gl);
    gl.drawArrays = (...args) => {
      draws++;
      original(...args);
    };
    const elements = gl.drawElements.bind(gl);
    gl.drawElements = (...args) => {
      draws++;
      elements(...args);
    };
    const start = performance.now();
    for (let i = 0; i < 120; i++) r.update({ rotation: i });
    const cpuMs = performance.now() - start,
      synchronousDrawCalls = draws;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const drawCallsAfterOneFrame = draws;
    r.destroy();
    return { updates: 120, cpuMs, synchronousDrawCalls, drawCallsAfterOneFrame };
  });
  await page.getByRole("button", { name: "Lire", exact: true }).click();
  await page.evaluate(() => {
    const samples: { gapMs: number; playhead: string }[] = [];
    const tasks: number[] = [];
    const benchmark = { samples, tasks, done: false };
    Object.assign(window, { __gradientBenchmark: benchmark });
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) tasks.push(entry.duration);
      });
      observer.observe({ type: "longtask" });
    }
    let last = performance.now();
    const tick = (now: number) => {
      samples.push({
        gapMs: now - last,
        playhead: String(
          document.querySelector(".timeline-playhead")?.getBoundingClientRect().x ?? "",
        ),
      });
      last = now;
      if (samples.length < 50) requestAnimationFrame(tick);
      else benchmark.done = true;
    };
    requestAnimationFrame(tick);
  });
  const slider = page
    .getByRole("slider", { name: "Fusion", exact: true })
    .locator('xpath=ancestor::*[@data-slot="slider"]');
  const box = await slider.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5, { steps: 40 });
    await page.mouse.up();
  }
  await page.waitForFunction(() => Reflect.get(window, "__gradientBenchmark")?.done);
  const ui = await page.evaluate(() => {
    const b = Reflect.get(window, "__gradientBenchmark") as {
      samples: { gapMs: number; playhead: string }[];
      tasks: number[];
    };
    const gaps = b.samples
      .slice(1)
      .map((s) => s.gapMs)
      .sort((a, b) => a - b);
    return {
      samples: b.samples.length,
      distinctPlayheadPositions: new Set(b.samples.map((s) => s.playhead)).size,
      frameGapMedianMs: gaps[Math.floor(gaps.length / 2)],
      frameGapP95Ms: gaps[Math.floor(gaps.length * 0.95)],
      longTasks: b.tasks.length,
      longestTaskMs: Math.max(0, ...b.tasks),
    };
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: /Couleurs 1 #/ }).click();
  await page.evaluate(() => {
    const gl = document
      .querySelector<HTMLCanvasElement>('[data-testid="gradient-canvas"]')!
      .getContext("webgl")!;
    const draw = gl.drawArrays.bind(gl);
    const sample = { events: 0, draws: 0, latencies: [] as number[], last: 0, rendered: 0 };
    Reflect.set(window, "__colorBenchmark", sample);
    document.querySelector(".react-colorful")!.addEventListener(
      "pointermove",
      () => {
        sample.events++;
        sample.last = performance.now();
      },
      { capture: true },
    );
    gl.drawArrays = (...args) => {
      draw(...args);
      sample.draws++;
      if (sample.events > sample.rendered) {
        sample.latencies.push(performance.now() - sample.last);
        sample.rendered = sample.events;
      }
    };
  });
  const colorBox = await page.locator(".react-colorful__saturation").boundingBox();
  await page.mouse.move(colorBox!.x + colorBox!.width * 0.2, colorBox!.y + colorBox!.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(
    colorBox!.x + colorBox!.width * 0.85,
    colorBox!.y + colorBox!.height * 0.75,
    { steps: 40 },
  );
  await page.mouse.up();
  const colorPicker = await page.evaluate(() => {
    const sample = Reflect.get(window, "__colorBenchmark") as {
      events: number;
      draws: number;
      latencies: number[];
    };
    const sorted = [...sample.latencies].sort((a, b) => a - b);
    return {
      pointerEvents: sample.events,
      renderedUpdates: sorted.length,
      postPassDraws: sample.draws,
      inputToDrawMedianMs: sorted[Math.floor(sorted.length / 2)] ?? null,
      inputToDrawP95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? null,
      measurement: "CPU pointer event to WebGL draw dispatch; excludes GPU completion",
    };
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  const libraryStart = Date.now();
  await page.getByRole("tab", { name: "Modèles", exact: true }).click();
  await page.locator(".template-card").first().locator("img").waitFor();
  const library = {
    modelCount: await page.locator(".template-card").count(),
    initiallyDecodedPreviews: await page.locator(".template-card img").count(),
    firstPreviewReadyWallMs: Date.now() - libraryStart,
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/performance.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        environment:
          "Playwright Chromium; software WebGL; 1280x800; results are local measurements, not hardware FPS guarantees",
        baseline: { updates: 120, cpuMs: 19.4, synchronousDrawCalls: 240 },
        renderer,
        ui,
        colorPicker,
        library,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ renderer, ui, colorPicker, library }));
} finally {
  await browser.close();
}
