import { test, expect } from "@playwright/test";

test("the portable engine stacks all five GPU effects, respects order and bypass, and closes every loop", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click(),
  );
  const result = await page.evaluate(async () => {
    const coreUrl = "/lib/core.js",
      engineUrl = "/lib/webgl.js";
    const { createEffect, effectTypes, serializeConfig, deserializeConfig } = await import(coreUrl);
    const { GradientRenderer } = await import(engineUrl);
    const canvas = document.createElement("canvas");
    const r = new GradientRenderer(canvas, {
      width: 96,
      height: 64,
      playing: false,
      config: { grain: 0, vignette: 0, chromaticShift: 0, loopDuration: 4 },
    });
    const gl = canvas.getContext("webgl")!;
    const read = () => {
      const data = new Uint8Array(96 * 64 * 4);
      gl.readPixels(0, 0, 96, 64, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    };
    const hash = (data: Uint8Array) => data.reduce((h, n) => (Math.imul(h, 31) + n) | 0, 0);
    r.seek(0.7);
    const original = read();
    const hashes: number[] = [],
      seams: boolean[] = [];
    for (const type of effectTypes) {
      r.update({ effects: [createEffect(type, type)] });
      r.seek(0.7);
      hashes.push(hash(read()));
      r.seek(0);
      const start = hash(read());
      r.seek(4);
      seams.push(start === hash(read()));
    }
    const blocks = createEffect("blocks", "mosaic"),
      dither = createEffect("dither", "print");
    r.update({ effects: [blocks, dither] });
    r.seek(0.7);
    const forward = hash(read());
    r.update({ effects: [dither, blocks] });
    r.seek(0.7);
    const backward = hash(read());
    r.update({
      effects: [
        { ...blocks, enabled: false },
        { ...dither, enabled: false },
      ],
    });
    r.seek(0.7);
    const bypass = hash(read()) === hash(original);
    r.update({ effects: [{ ...blocks, opacity: 0 }] });
    r.seek(0.7);
    const transparent = hash(read()) === hash(original);
    r.update({
      effects: effectTypes.map((type: string, index: number) => createEffect(type, `fx-${index}`)),
    });
    r.seek(0.7);
    const combined = read();
    const stats = {
      hashes,
      seams,
      forward,
      backward,
      bypass,
      transparent,
      combinedVaries: new Set(combined).size,
      error: gl.getError(),
    };
    r.update({ effects: [{ ...blocks, composite: "clear" }] });
    r.seek(0.7);
    const png = await r.snapshot(),
      bitmap = await createImageBitmap(png);
    const output = document.createElement("canvas");
    output.width = bitmap.width;
    output.height = bitmap.height;
    const outputContext = output.getContext("2d")!;
    outputContext.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pngAlpha = outputContext.getImageData(40, 30, 1, 1).data[3];
    r.destroy();
    const config = deserializeConfig(serializeConfig({ effects: [blocks, dither] }));
    return {
      ...stats,
      pngAlpha,
      roundtrip: config.effects.map((effect: { id: string }) => effect.id),
    };
  });
  expect(new Set(result.hashes).size).toBe(5);
  expect(result.seams.every(Boolean)).toBe(true);
  expect(result.forward).not.toBe(result.backward);
  expect(result.bypass).toBe(true);
  expect(result.transparent).toBe(true);
  expect(result.combinedVaries).toBeGreaterThan(20);
  expect(result.error).toBe(0);
  expect(result.roundtrip).toEqual(["mosaic", "print"]);
  expect(result.pngAlpha).toBe(0);
});

test("GPU compositing agrees with browser blend references and analytic alpha composition", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click();
    document.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')?.click();
  });
  const result = await page.evaluate(async () => {
    const url = "/lib/webgl.js",
      core = "/lib/core.js";
    const { TextureCompositePass } = await import(url);
    const { blendModes, compositeModes } = await import(core);
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false })!;
    const colors = [
      [52, 154, 203, 153],
      [231, 93, 61, 179],
    ];
    const texture = (color: number[]) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
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
      return t;
    };
    const inputs = colors.map(texture),
      opaque = colors.map((color) => texture([...color.slice(0, 3), 255]));
    const pass = new TextureCompositePass(gl);
    const draw = (
      textures: WebGLTexture[],
      blendMode: string,
      composite = "source-over",
      opacity = 1,
    ) => {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, 0, 0, 0);
      gl.colorMask(false, false, false, false);
      pass.draw(textures[0], textures[1], 4, 4, { opacity, blendMode, composite });
      const data = new Uint8Array(4);
      gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return [...data];
    };
    const standard = [
      "normal",
      "multiply",
      "screen",
      "overlay",
      "darken",
      "lighten",
      "color-dodge",
      "color-burn",
      "hard-light",
      "soft-light",
      "difference",
      "exclusion",
      "hue",
      "saturation",
      "color",
      "luminosity",
    ];
    const reference = document.createElement("canvas");
    reference.width = 4;
    reference.height = 4;
    const ctx = reference.getContext("2d")!;
    const native: Record<string, number[]> = {};
    const blendReferences = standard.map((mode) => {
      // Opaque inputs isolate the color blend from browser-specific 8-bit alpha rounding.
      ctx.clearRect(0, 0, 4, 4);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgb(${colors[0].slice(0, 3).join(",")})`;
      ctx.fillRect(0, 0, 4, 4);
      ctx.globalCompositeOperation = (
        mode === "normal" ? "source-over" : mode
      ) as GlobalCompositeOperation;
      ctx.fillStyle = `rgb(${colors[1].slice(0, 3).join(",")})`;
      ctx.fillRect(0, 0, 4, 4);
      const expected = [...ctx.getImageData(2, 2, 1, 1).data];
      native[mode] = expected;
      const gpu = draw(opaque, mode);
      return {
        mode,
        gpu,
        expected,
        error: Math.max(...gpu.map((value, index) => Math.abs(value - expected[index]))),
      };
    });
    // W3C general formula: blend unassociated colors, then apply Porter-Duff
    // factors in premultiplied space. This avoids low-alpha getImageData rounding.
    const sa = (colors[1][3] / 255) * 0.75,
      ba = colors[0][3] / 255;
    const factors: Record<string, [number, number]> = {
      "source-over": [1, 1 - sa],
      "destination-over": [1 - ba, 1],
      "source-in": [ba, 0],
      "destination-in": [0, sa],
      "source-out": [1 - ba, 0],
      "destination-out": [0, 1 - sa],
      "source-atop": [ba, 1 - sa],
      "destination-atop": [1 - ba, sa],
      xor: [1 - ba, 1 - sa],
      copy: [1, 0],
      destination: [0, 1],
      clear: [0, 0],
      lighter: [1, 1],
    };
    const alphaReference = (mode: string, operation: string) => {
      const [fa, fb] = factors[operation],
        alpha = Math.min(1, sa * fa + ba * fb);
      const rgb = colors[1].slice(0, 3).map((value, index) => {
        const blended = ((1 - ba) * value) / 255 + (ba * native[mode][index]) / 255;
        const premult = sa * fa * blended + (ba * fb * colors[0][index]) / 255;
        return alpha ? Math.min(1, premult / alpha) * 255 : 0;
      });
      const expected = [...rgb, alpha * 255],
        gpu = draw(inputs, mode, operation, 0.75);
      return {
        mode,
        operation,
        gpu,
        expected,
        error: Math.max(...gpu.map((value, index) => Math.abs(value - expected[index]))),
      };
    };
    const alphaReferences = [
      ...compositeModes.map((operation: string) => alphaReference("normal", operation)),
      ...standard.map((mode) => alphaReference(mode, "source-over")),
    ];
    const extended = blendModes.map((mode: string) => draw(inputs, mode));
    pass.destroy();
    const retained = [...inputs, ...opaque].every((t) => gl.isTexture(t));
    [...inputs, ...opaque].forEach((t) => gl.deleteTexture(t));
    return { blendReferences, alphaReferences, extended, retained, error: gl.getError() };
  });
  for (const sample of result.blendReferences)
    expect(sample.error, JSON.stringify(sample)).toBeLessThanOrEqual(2);
  for (const sample of result.alphaReferences)
    expect(sample.error, JSON.stringify(sample)).toBeLessThanOrEqual(2);
  expect(result.extended).toHaveLength(26);
  expect(result.extended.every((pixel: number[]) => pixel[3] > 0)).toBe(true);
  expect(result.retained).toBe(true);
  expect(result.error).toBe(0);
});

test("the effect stack edits, reorders, saves and exports the actual independent settings", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click(),
  );
  await expect(page.getByTestId("effect-stack")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter un effet", exact: true }).click();
  await page.getByRole("button", { name: "Blocks", exact: true }).click();
  await page.getByRole("textbox", { name: "Feather — Réglages", exact: true }).fill("0.42");
  await page.getByRole("textbox", { name: "Feather — Réglages", exact: true }).blur();
  await page.getByRole("button", { name: "Ajouter un effet", exact: true }).click();
  await page.getByRole("button", { name: "Glass", exact: true }).click();
  const handle = page.locator('[data-effect-type="glass"] .effect-grip');
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("status")).toContainText("was moved over droppable area");
  await page.keyboard.press("Space");
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("gradient-document")!).config.effects.map(
          (effect: { type: string }) => effect.type,
        ),
      ),
    )
    .toEqual(["glass", "blocks"]);
  await page.getByRole("button", { name: "Masquer Blocks", exact: true }).click();
  await expect(page.locator('[data-effect-type="blocks"]')).toHaveAttribute(
    "data-enabled",
    "false",
  );
  await page.getByRole("button", { name: "Afficher Blocks", exact: true }).click();
  const config = await page.evaluate(
    () => JSON.parse(localStorage.getItem("gradient-document")!).config,
  );
  expect(
    config.effects.find((effect: { type: string }) => effect.type === "blocks").params.feather,
  ).toBe(0.42);
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("textbox", { name: "Nom du preset", exact: true }).fill("Stack GPU");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Preset Stack GPU", exact: true })).toBeVisible();
  await page.reload();
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click(),
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("gradient-document")!).config.effects,
    ),
  ).toEqual(config.effects);
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await expect(page.getByRole("button", { name: "Preset Stack GPU", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".dock-actions").getByRole("button", { name: "Code", exact: true }).click();
  await page.getByRole("tab", { name: "JSON", exact: true }).click();
  const exported = JSON.parse(await page.locator("pre").innerText());
  expect(exported.version).toBe(2);
  expect(exported.config.effects).toEqual(config.effects);
});
