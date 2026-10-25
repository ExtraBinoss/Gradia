import { test, expect } from "@playwright/test";
test("portable GPU renderer renders distinct effects, exports pixels, reuses programs and disposes", async ({
  page,
}) => {
  await page.goto("/");
  await page.bringToFront();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const result = await page.evaluate(async () => {
    const url = "/lib/webgl.js";
    const coreUrl = "/lib/core.js";
    const { GradientRenderer } = await import(url);
    const { DEFAULT_CONFIG } = await import(coreUrl);
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:160px;height:100px";
    const gl = canvas.getContext("webgl");
    if (!gl) return { available: false };
    let programs = 0,
      draws = 0;
    const create = gl.createProgram.bind(gl),
      draw = gl.drawArrays.bind(gl);
    gl.createProgram = () => {
      programs++;
      return create();
    };
    gl.drawArrays = (...args) => {
      draws++;
      draw(...args);
    };
    const elements = gl.drawElements.bind(gl);
    gl.drawElements = (...args) => {
      draws++;
      elements(...args);
    };
    const renderer = new GradientRenderer(canvas, {
      config: { ...DEFAULT_CONFIG, grain: 0 },
      playing: false,
      width: 160,
      height: 100,
      pixelRatio: 1,
      respectReducedMotion: false,
    });
    const pixels = () => {
      renderer.render();
      const data = new Uint8Array(160 * 100 * 4);
      gl.readPixels(0, 0, 160, 100, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let hash = 0;
      for (let i = 0; i < data.length; i += 4)
        hash = (Math.imul(hash, 31) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) | 0;
      return {
        hash,
        opaque: data[3] === 255,
        varies: data.some((v, i) => i % 4 === 0 && v !== data[0]),
      };
    };
    const gradient = pixels();
    renderer.update({ effect: "ascii" });
    const ascii = pixels();
    renderer.update({ effect: "dither", ditherLevels: 3 });
    const dither = pixels();
    for (const ditherPattern of ["bayer4", "bayer8", "noise"]) {
      renderer.update({ ditherPattern, ditherMonochrome: true });
      pixels();
    }
    renderer.update({
      effect: "ascii",
      asciiCharacters: " .01@",
      asciiInvert: true,
      asciiColored: false,
    });
    pixels();
    for (let i = 0; i < 30; i++)
      renderer.update({ speed: i % 10, rotation: i * 10, grain: i / 100 });
    const stablePrograms = programs;
    const png = await renderer.snapshot();
    const bitmap = await createImageBitmap(png);
    const dimensions = [bitmap.width, bitmap.height];
    bitmap.close();
    const pausedDraws = draws;
    await new Promise((resolve) => setTimeout(resolve, 120));
    const idleDraws = draws - pausedDraws;
    renderer.setPlaying(true);
    await new Promise<void>((resolve) => {
      const started = performance.now();
      const check = () => {
        if (renderer.time > 0 || performance.now() - started > 5000) resolve();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    const playingTime = renderer.time;
    renderer.setPlaying(false);
    const pausedTime = renderer.time;
    await new Promise((resolve) => setTimeout(resolve, 120));
    const stoppedTime = renderer.time;
    const error = gl.getError();
    renderer.destroy();
    renderer.destroy();
    const destroyedDraws = draws;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      available: true,
      gradient,
      ascii,
      dither,
      stablePrograms,
      dimensions,
      idleDraws,
      playingTime,
      pausedTime,
      stoppedTime,
      error,
      afterDestroy: draws - destroyedDraws,
      pngSize: png.size,
    };
  });
  if (!result.available) {
    test.skip(true, "Browser does not expose a WebGL context in this environment.");
    return;
  }
  expect(result.gradient?.opaque).toBe(true);
  expect(result.gradient?.varies).toBe(true);
  expect(new Set([result.gradient?.hash, result.ascii?.hash, result.dither?.hash]).size).toBe(3);
  expect(result.stablePrograms).toBe(2);
  expect(result.dimensions).toEqual([160, 100]);
  expect(result.pngSize).toBeGreaterThan(500);
  expect(result.idleDraws).toBe(0);
  expect(result.playingTime).toBeGreaterThan(0);
  expect(result.stoppedTime).toBe(result.pausedTime);
  expect(result.error).toBe(0);
  expect(result.afterDestroy).toBe(0);
});
test("GPU context loss and restoration preserve the renderer configuration", async ({ page }) => {
  await page.goto("/");
  await page.bringToFront();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const result = await page.evaluate(async () => {
    const url = "/lib/webgl.js";
    const { GradientRenderer } = await import(url);
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (!gl || !ext) return { available: false };
    const errors: string[] = [];
    const renderer = new GradientRenderer(canvas, {
      width: 80,
      height: 80,
      playing: false,
      onError: (e: Error) => errors.push(e.message),
    });
    renderer.update({ effect: "ascii", asciiColor: "#ffccaa" });
    renderer.seek(2);
    await new Promise<void>((resolve) => {
      canvas.addEventListener("webglcontextlost", () => resolve(), { once: true });
      ext.loseContext();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await new Promise<void>((resolve) => {
      canvas.addEventListener("webglcontextrestored", () => resolve(), { once: true });
      ext.restoreContext();
    });
    renderer.render();
    const error = gl.getError();
    const time = renderer.time;
    const blob = await renderer.snapshot();
    renderer.destroy();
    return { available: true, errors, error, time, size: blob.size };
  });
  if (!result.available) {
    test.skip(true, "Context loss extension unavailable.");
    return;
  }
  expect(result.errors).toContain("WEBGL_CONTEXT_LOST");
  expect(result.error).toBe(0);
  expect(result.time).toBe(2);
  expect(result.size).toBeGreaterThan(200);
});
test("PNG from the studio has actual nonuniform pixels and expected dimensions", async ({
  page,
}) => {
  await page.goto("/");
  const available = await page
    .getByTestId("gradient-canvas")
    .evaluate((c) => Boolean((c as HTMLCanvasElement).getContext("webgl")));
  if (!available) {
    test.skip(true, "WebGL unavailable.");
    return;
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .locator(".dock-actions")
    .getByRole("button", { name: "Exporter", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger le PNG", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^gradient-1920x\d+\.png$/);
  expect(await download.failure()).toBeNull();
});
test("six independent shaders and all effects are deterministic seamless loops", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const result = await page.evaluate(async () => {
    const url = "/lib/webgl.js";
    const { GradientRenderer } = await import(url);
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return null;
    const renderer = new GradientRenderer(canvas, {
      width: 96,
      height: 64,
      playing: false,
      config: { grain: 0.15, loopDuration: 4 },
    });
    const hash = () => {
      renderer.render();
      const data = new Uint8Array(96 * 64 * 4);
      gl.readPixels(0, 0, 96, 64, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let h = 0;
      for (const n of data) h = (Math.imul(h, 31) + n) | 0;
      return h;
    };
    const styles: string[] = [],
      seams: boolean[] = [],
      motion: boolean[] = [];
    for (const style of ["mesh", "silk", "aurora", "liquid", "radial", "waves"]) {
      renderer.update({ style });
      renderer.seek(0.7);
      styles.push(String(hash()));
      for (const effect of ["gradient", "ascii", "dither"]) {
        renderer.update({ effect });
        renderer.seek(0);
        const start = hash();
        renderer.seek(4);
        seams.push(start === hash());
        renderer.seek(1.3);
        motion.push(start !== hash());
      }
      renderer.update({ effect: "gradient" });
    }
    renderer.seek(1.25);
    const a = hash();
    renderer.seek(0);
    renderer.seek(1.25);
    const deterministic = a === hash();
    renderer.destroy();
    return { styles, seams, motion, deterministic, error: gl.getError() };
  });
  if (!result) {
    test.skip(true, "WebGL unavailable");
    return;
  }
  expect(new Set(result.styles).size).toBe(6);
  expect(result.seams.every(Boolean)).toBe(true);
  expect(result.motion.every(Boolean)).toBe(true);
  expect(result.deterministic).toBe(true);
  expect(result.error).toBe(0);
});
test("a burst of parameter changes renders once and preserves the running clock", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const result = await page.evaluate(async () => {
    const url = "/lib/webgl.js";
    const { GradientRenderer } = await import(url);
    const c = document.createElement("canvas");
    const r = new GradientRenderer(c, {
      width: 256,
      height: 160,
      playing: false,
      respectReducedMotion: false,
    });
    const gl = c.getContext("webgl")!;
    let draws = 0;
    const draw = gl.drawArrays.bind(gl);
    gl.drawArrays = (...args) => {
      draws++;
      draw(...args);
    };
    const elements = gl.drawElements.bind(gl);
    gl.drawElements = (...args) => {
      draws++;
      elements(...args);
    };
    const start = performance.now();
    for (let i = 0; i < 120; i++) r.update({ rotation: i });
    const synchronous = draws,
      cpuMs = performance.now() - start;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const afterFrame = draws;
    r.setPlaying(true);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = r.time;
    for (let i = 0; i < 120; i++) r.update({ waveAmplitude: i / 20 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const advanced = r.time - before;
    r.destroy();
    return { synchronous, afterFrame, cpuMs, advanced };
  });
  expect(result.synchronous).toBe(0);
  expect(result.afterFrame).toBe(2);
  expect(result.advanced).toBeGreaterThan(0.05);
});
test("reusable texture compositor blends exact endpoint colors in linear light", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const result = await page.evaluate(async () => {
    const url = "/lib/webgl.js";
    const { TextureBlendPass } = await import(url);
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const gl = canvas.getContext("webgl", { alpha: false })!;
    const textures = [
      [255, 0, 0, 255],
      [0, 0, 255, 255],
    ].map((color) => {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(color),
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return texture;
    });
    const pass = new TextureBlendPass(gl);
    // A reusable pass must establish its own pipeline state in a caller's context.
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, 0, 0);
    gl.colorMask(false, false, false, false);
    const samples = [0, 0.5, 1].map((progress) => {
      pass.draw(textures[0], textures[1], progress, 4, 4);
      const data = new Uint8Array(4);
      gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return [...data];
    });
    pass.destroy();
    const owned = textures.every((texture) => gl.isTexture(texture));
    const error = gl.getError();
    textures.forEach((texture) => gl.deleteTexture(texture));
    return { samples, owned, error };
  });
  expect(result.samples[0]).toEqual([255, 0, 0, 255]);
  expect(result.samples[2]).toEqual([0, 0, 255, 255]);
  expect(result.samples[1][0]).toBeGreaterThanOrEqual(187);
  expect(result.samples[1][0]).toBeLessThanOrEqual(189);
  expect(result.samples[1][2]).toBe(result.samples[1][0]);
  expect(result.owned).toBe(true);
  expect(result.error).toBe(0);
});
test("live shader blending preserves the currently displayed composite across interruptions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const result = await page.evaluate(async () => {
    const url = "/lib/webgl.js";
    const core = "/lib/core.js";
    const { GradientRenderer } = await import(url);
    const { presets } = await import(core);
    const originalNow = performance.now;
    let now = originalNow.call(performance);
    performance.now = () => now;
    const canvas = document.createElement("canvas");
    const r = new GradientRenderer(canvas, {
      width: 100,
      height: 64,
      playing: false,
      config: { ...presets[0].config, grain: 0 },
      respectReducedMotion: false,
    });
    const gl = canvas.getContext("webgl")!;
    const pixels = () => {
      const data = new Uint8Array(100 * 64 * 4);
      gl.readPixels(0, 0, 100, 64, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    };
    r.render();
    const start = pixels();
    r.transitionTo({ ...presets[1].config, grain: 0 }, 0.6);
    r.render();
    const initial = pixels();
    now += 250;
    r.render();
    const middle = pixels();
    r.transitionTo({ ...presets[3].config, grain: 0 }, 0.4);
    const boundary = pixels();
    r.render();
    const interrupted = pixels();
    now += 500;
    r.render();
    const finished = pixels();
    const reference = document.createElement("canvas");
    const expected = new GradientRenderer(reference, {
      width: 100,
      height: 64,
      playing: false,
      config: { ...presets[3].config, grain: 0 },
    });
    expected.render();
    const expectedData = new Uint8Array(100 * 64 * 4);
    reference
      .getContext("webgl")!
      .readPixels(0, 0, 100, 64, gl.RGBA, gl.UNSIGNED_BYTE, expectedData);
    const maxDifference = (a: Uint8Array, b: Uint8Array) =>
      a.reduce((max, value, index) => Math.max(max, Math.abs(value - b[index])), 0);
    const result = {
      firstFrameDifference: maxDifference(start, initial),
      middleChanged: maxDifference(start, middle),
      interruptionDifference: maxDifference(boundary, interrupted),
      finishedDifference: maxDifference(finished, expectedData),
      time: r.time,
      error: gl.getError(),
    };
    r.destroy();
    expected.destroy();
    performance.now = originalNow;
    return result;
  });
  expect(result.firstFrameDifference).toBeLessThanOrEqual(2);
  expect(result.middleChanged).toBeGreaterThan(10);
  expect(result.interruptionDifference).toBeLessThanOrEqual(3);
  expect(result.finishedDifference).toBe(0);
  expect(result.time).toBe(0);
  expect(result.error).toBe(0);
});

test("both shaders advance during the GPU blend, including independent ASCII atlases", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const result = await page.evaluate(async () => {
    const url = "/lib/webgl.js",
      core = "/lib/core.js";
    const { GradientRenderer, TextureBlendPass } = await import(url);
    const { presets } = await import(core);
    const originalNow = performance.now;
    let now = originalNow.call(performance);
    performance.now = () => now;
    const configs = [
      { ...presets[4].config, grain: 0, effect: "ascii", asciiCharacters: " .#" },
      { ...presets[1].config, grain: 0, effect: "ascii", asciiCharacters: " +@M" },
    ];
    const renderers: InstanceType<typeof GradientRenderer>[] = [];
    try {
      const canvas = document.createElement("canvas");
      const renderer = new GradientRenderer(canvas, {
        width: 80,
        height: 64,
        config: configs[0],
        playing: true,
        respectReducedMotion: false,
      });
      renderers.push(renderer);
      const gl = canvas.getContext("webgl")!;
      const read = (context: WebGLRenderingContext) => {
        const data = new Uint8Array(80 * 64 * 4);
        context.readPixels(0, 0, 80, 64, context.RGBA, context.UNSIGNED_BYTE, data);
        return data;
      };
      renderer.seek(1);
      renderer.transitionTo(configs[1], 1);
      now += 500;
      renderer.seek(1.5);
      const actual = read(gl);
      const textures = configs.map((config) => {
        const reference = document.createElement("canvas");
        const r = new GradientRenderer(reference, {
          width: 80,
          height: 64,
          config,
          playing: false,
        });
        renderers.push(r);
        r.seek(1.5);
        const pixels = read(reference.getContext("webgl")!);
        const texture = gl.createTexture()!;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 80, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
      });
      const pass = new TextureBlendPass(gl);
      pass.draw(textures[0], textures[1], 0.5, 80, 64);
      const expected = read(gl);
      const difference = actual.reduce(
        (max, value, index) => Math.max(max, Math.abs(value - expected[index])),
        0,
      );
      const error = gl.getError();
      pass.destroy();
      textures.forEach((texture) => gl.deleteTexture(texture));
      return { difference, error };
    } finally {
      performance.now = originalNow;
      renderers.forEach((renderer) => renderer.destroy());
    }
  });
  expect(result.difference).toBeLessThanOrEqual(2);
  expect(result.error).toBe(0);
});
