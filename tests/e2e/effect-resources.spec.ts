import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("effect edits coalesce, GPU allocations stay bounded, and every owned resource is released", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click();
    document.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')?.click();
  });
  const result = await page.evaluate(async () => {
    const engineUrl = "/lib/webgl.js",
      coreUrl = "/lib/core.js";
    const { GradientRenderer } = await import(engineUrl);
    const { createEffect } = await import(coreUrl);
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false })!;
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const adapter = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    const live = {
      program: new Set<object>(),
      texture: new Set<object>(),
      framebuffer: new Set<object>(),
      buffer: new Set<object>(),
      shader: new Set<object>(),
    };
    const created = { program: 0, texture: 0, framebuffer: 0, buffer: 0, shader: 0 };
    const peak = { program: 0, texture: 0, framebuffer: 0, buffer: 0, shader: 0 };
    for (const [key, allocate, release] of [
      ["program", "createProgram", "deleteProgram"],
      ["texture", "createTexture", "deleteTexture"],
      ["framebuffer", "createFramebuffer", "deleteFramebuffer"],
      ["buffer", "createBuffer", "deleteBuffer"],
      ["shader", "createShader", "deleteShader"],
    ] as const) {
      const make = Reflect.get(gl, allocate) as (...args: unknown[]) => object | null;
      const drop = Reflect.get(gl, release) as (value: object | null) => void;
      Reflect.set(gl, allocate, (...args: unknown[]) => {
        const value = Reflect.apply(make, gl, args) as object | null;
        if (value) {
          live[key].add(value);
          created[key]++;
          peak[key] = Math.max(peak[key], live[key].size);
        }
        return value;
      });
      Reflect.set(gl, release, (value: object | null) => {
        if (value) live[key].delete(value);
        Reflect.apply(drop, gl, [value]);
      });
    }
    let draws = 0,
      uploads = 0,
      readbacks = 0;
    for (const [method, count] of [
      ["drawArrays", () => draws++],
      ["drawElements", () => draws++],
      ["texImage2D", () => uploads++],
      ["readPixels", () => readbacks++],
    ] as const) {
      const original = Reflect.get(gl, method) as (...args: unknown[]) => unknown;
      Reflect.set(gl, method, (...args: unknown[]) => {
        count();
        return Reflect.apply(original, gl, args);
      });
    }
    const blocks = createEffect("blocks", "tiles"),
      glass = createEffect("glass", "glass"),
      dither = createEffect("dither", "print");
    const r = new GradientRenderer(canvas, {
      width: 256,
      height: 160,
      pixelRatio: 1,
      playing: false,
      respectReducedMotion: false,
      config: { grain: 0, effects: [blocks, glass, dither] },
    });
    const pixels = () => {
      const data = new Uint8Array(256 * 160 * 4);
      gl.readPixels(0, 0, 256, 160, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return {
        hash: data.reduce((h, n) => (Math.imul(h, 31) + n) | 0, 0),
        distinct: new Set(data).size,
      };
    };
    r.seek(0.7);
    const before = pixels(),
      warmCreated = { ...created },
      warmUploads = uploads;
    const drawStart = draws,
      readStart = readbacks,
      cpuStart = performance.now();
    for (let index = 0; index < 120; index++) {
      r.update({
        effects: [
          { ...blocks, params: { ...blocks.params, size: 64 + index * 0.25 } },
          glass,
          dither,
        ],
      });
    }
    const cpuMs = performance.now() - cpuStart;
    const synchronousDrawCalls = draws - drawStart,
      synchronousReadbacks = readbacks - readStart;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const drawCallsAfterOneFrame = draws - drawStart;
    const after = pixels();
    for (const blendMode of ["normal", "multiply", "screen", "soft-light"]) {
      r.update({ effects: [{ ...blocks, blendMode }, glass, dither] });
      r.seek(0.7);
    }
    const steady = { created: { ...created }, uploads, warmCreated, warmUploads };

    const asciiA = {
      ...createEffect("ascii", "ascii-a"),
      params: { ...createEffect("ascii").params, characters: " .#" },
    };
    const asciiB = {
      ...createEffect("ascii", "ascii-b"),
      opacity: 0.6,
      blendMode: "screen",
      params: { ...createEffect("ascii").params, characters: " +@M" },
    };
    r.update({ effects: [asciiA, asciiB] });
    r.seek(0.7);
    const independentAscii = pixels();
    const asciiUploads = uploads,
      asciiCreated = { ...created };
    for (let index = 0; index < 8; index++) {
      r.update({
        effects: [{ ...asciiA, params: { ...asciiA.params, size: 10 + index } }, asciiB],
      });
      r.seek(0.7);
    }
    const unchangedAtlas = {
      uploads: uploads - asciiUploads,
      allocations: created.texture - asciiCreated.texture,
    };
    for (let index = 0; index < 12; index++) {
      r.update({
        effects: [
          asciiA,
          {
            ...asciiB,
            params: { ...asciiB.params, characters: ` .${String.fromCharCode(65 + index)}` },
          },
        ],
      });
      r.seek(0.7);
    }
    const afterCharacterEdits = Object.fromEntries(
      Object.entries(live).map(([key, values]) => [key, values.size]),
    );
    const originalNow = performance.now;
    let now = originalNow.call(performance);
    performance.now = () => now;
    let transitionPixels = independentAscii.hash;
    try {
      for (let index = 0; index < 8; index++) {
        const first = {
          ...asciiA,
          params: { ...asciiA.params, characters: ` .${String.fromCharCode(80 + index)}` },
        };
        const second = {
          ...asciiB,
          params: { ...asciiB.params, characters: ` +${String.fromCharCode(65 + index)}` },
        };
        r.transitionTo({ effects: [first, second] }, 0.1);
        now += 50;
        r.render();
        transitionPixels = pixels().hash;
        if (index % 3 === 0) {
          r.transitionTo({ effects: [first, { ...second, blendMode: "overlay" }] }, 0.1);
          r.render();
        }
        now += 200;
        r.render();
      }
    } finally {
      performance.now = originalNow;
    }
    const activeAtEnd = Object.fromEntries(
      Object.entries(live).map(([key, values]) => [key, values.size]),
    );
    const error = gl.getError();
    r.destroy();
    r.destroy();
    const remaining = Object.fromEntries(
      Object.entries(live).map(([key, values]) => [key, values.size]),
    );
    const afterDestroyDraws = draws;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      adapter,
      updates: 120,
      cpuMs,
      synchronousDrawCalls,
      synchronousReadbacks,
      drawCallsAfterOneFrame,
      before,
      after,
      steady,
      independentAscii,
      unchangedAtlas,
      afterCharacterEdits,
      transitionPixels,
      activeAtEnd,
      peak,
      remaining,
      error,
      drawsAfterDestroy: draws - afterDestroyDraws,
    };
  });
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/effects-performance.json",
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        environment:
          "Playwright Chromium, 256×160 offscreen WebGL; timings measure CPU dispatch and do not guarantee hardware FPS",
        softwareGPU: /swiftshader|llvmpipe|software/i.test(result.adapter),
        ...result,
      },
      null,
      2,
    ) + "\n",
  );
  expect(result.before.distinct).toBeGreaterThan(20);
  expect(result.after.hash).not.toBe(result.before.hash);
  expect(result.synchronousDrawCalls).toBe(0);
  expect(result.synchronousReadbacks).toBe(0);
  expect(result.drawCallsAfterOneFrame).toBe(5);
  expect(result.steady.created).toEqual(result.steady.warmCreated);
  expect(result.steady.uploads).toBe(result.steady.warmUploads);
  expect(result.independentAscii.distinct).toBeGreaterThan(20);
  expect(result.unchangedAtlas).toEqual({ uploads: 0, allocations: 0 });
  expect(result.afterCharacterEdits.texture).toBe(6);
  expect(result.peak.texture).toBeLessThanOrEqual(11);
  expect(result.peak.framebuffer).toBeLessThanOrEqual(6);
  expect(result.activeAtEnd.texture).toBe(9);
  expect(Object.values(result.remaining).every((value) => value === 0)).toBe(true);
  expect(result.drawsAfterDestroy).toBe(0);
  expect(result.error).toBe(0);
});
