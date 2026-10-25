import { test, expect } from "@playwright/test";

test("brand intro returns on reload, completes automatically, and can be skipped", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("studio-intro")).toBeVisible();
  await expect(page.getByTestId("studio-intro")).toHaveCount(0, { timeout: 6500 });
  await expect(page.locator(".settings-float")).toBeVisible();
  await expect(page.locator(".settings-float")).toHaveCSS("opacity", "1");
  await expect(page.getByRole("button", { name: "Presets", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("gradient-document"))).toBeNull();
  await page.reload();
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click(),
  );
  await expect(page.getByTestId("studio-intro")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Contraste — Réglages", exact: true }),
  ).toHaveValue("1");
});

test("32 curated models load real previews on demand in the shared scrollbar", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click(),
  );
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("tab", { name: "Modèles", exact: true }).click();
  await expect(page.locator(".template-card")).toHaveCount(32);
  await expect(page.locator(".template-card").first().locator("img")).toHaveAttribute(
    "src",
    /^data:image\/webp;base64,/,
  );
  await expect(page.locator(".template-card").first().locator(".shader-preview-current")).toHaveCSS(
    "animation-name",
    "preview-reveal",
  );
  const rail = page.locator('.template-scroll [data-slot="scroll-area-scrollbar"]');
  await expect(rail).toBeVisible();
  const flush = await rail.evaluate(
    (el) => el.parentElement!.getBoundingClientRect().right - el.getBoundingClientRect().right,
  );
  expect(flush).toBeLessThanOrEqual(3);
  const viewport = page.locator('.template-scroll [data-slot="scroll-area-viewport"]');
  await viewport.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(
    page.getByRole("button", { name: "Template Halftone", exact: true }).locator("img"),
  ).toHaveAttribute("src", /^data:image\/webp;base64,/);
});

test("system theme paints the HTML and body before JavaScript runs", async ({ browser }) => {
  for (const colorScheme of ["dark", "light"] as const) {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme });
    const page = await context.newPage();
    await page.goto("/");
    const expected = colorScheme === "dark" ? "rgb(21, 22, 27)" : "rgb(247, 248, 250)";
    await expect(page.locator("html")).toHaveCSS("background-color", expected);
    await expect(page.locator("body")).toHaveCSS("background-color", expected);
    await context.close();
  }
});

test("properties use a separate effect stack, shared theme tabs, fitting duration controls, and matching pill radii", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click(),
  );
  await expect(page.locator(".document-state,.settings-dot")).toHaveCount(0);
  await page.getByRole("button", { name: "Durée de la boucle", exact: true }).click();
  const fit = await page.locator(".duration-popover").evaluate((el) => {
    const box = el.getBoundingClientRect();
    return [...el.querySelectorAll("input,button")].every((child) => {
      const b = child.getBoundingClientRect();
      return b.left >= box.left && b.right <= box.right;
    });
  });
  expect(fit).toBe(true);
  await page.keyboard.press("Escape");
  const radii = await page.locator(".tools-pill").evaluate((el) => ({
    outer: getComputedStyle(el).borderRadius,
    inner: [...el.querySelectorAll("button")].map(
      (button) => getComputedStyle(button).borderRadius,
    ),
  }));
  expect(radii.inner.every((radius) => radius === radii.outer)).toBe(true);
  const centered = await page.evaluate(() =>
    [".studio-dock", ".variations-dock"].map((selector) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return Math.abs(box.x + box.width / 2 - innerWidth / 2);
    }),
  );
  expect(centered.every((offset) => offset < 1)).toBe(true);
  await expect(page.locator(".dock-actions > :last-child")).not.toHaveClass("toolbar-divider");
  await expect(page.locator(".effect-tabs")).toHaveCount(0);
  await expect(page.getByTestId("effect-stack")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sélectionner Gradient", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ajouter un effet", exact: true }).click();
  for (const name of ["ASCII", "Dither", "Blocks", "Glass", "Pliures"])
    await expect(
      page.locator(".effects-add-popover").getByRole("button", { name, exact: true }),
    ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  const library = await page
    .locator('.preset-library-tabs > [data-slot="tabs-list"]')
    .evaluate((el) => ({
      radius: getComputedStyle(el).borderRadius,
      background: getComputedStyle(el).backgroundColor,
    }));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Paramètres généraux", exact: true }).click();
  const theme = await page
    .locator('.global-settings-dialog [data-slot="tabs-list"]')
    .evaluate((el) => ({
      radius: getComputedStyle(el).borderRadius,
      background: getComputedStyle(el).backgroundColor,
    }));
  expect(theme).toEqual(library);
});

test("color edits render while the picker is open and remain a single cancelable preview", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click(),
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForTimeout(700); // Let the intro's return blend finish before comparing pixels.
  const before = await page.evaluate(() => {
    const gl = document
      .querySelector<HTMLCanvasElement>('[data-testid="gradient-canvas"]')!
      .getContext("webgl")!;
    const draw = gl.drawArrays.bind(gl);
    gl.drawArrays = (...args) => {
      draw(...args);
      const data = new Uint8Array(16 * 16 * 4);
      gl.readPixels(200, 200, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let hash = 2166136261;
      for (const value of data) hash = Math.imul(hash ^ value, 16777619);
      Reflect.set(window, "__colorPixels", hash >>> 0);
    };
    // Replay the paused post pass; preserveDrawingBuffer remains disabled in production.
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return Reflect.get(window, "__colorPixels") as number;
  });
  const pixels = () => page.evaluate(() => Reflect.get(window, "__colorPixels") as number);
  await page.getByRole("button", { name: /Couleurs 1 #27134f/ }).click();
  await page.getByRole("textbox", { name: "Couleurs 1", exact: true }).fill("#00ff00");
  await expect(page.getByRole("button", { name: /Couleurs 1 #00ff00/ })).toBeVisible();
  await expect(page.locator(".react-colorful")).toBeVisible();
  await expect.poll(pixels).not.toBe(before);
  const saturation = await page.locator(".react-colorful__saturation").boundingBox();
  await page.mouse.move(
    saturation!.x + saturation!.width * 0.7,
    saturation!.y + saturation!.height * 0.4,
  );
  await page.mouse.down();
  await page.mouse.move(
    saturation!.x + saturation!.width * 0.3,
    saturation!.y + saturation!.height * 0.7,
    { steps: 8 },
  );
  await expect(page.getByRole("textbox", { name: "Couleurs 1", exact: true })).not.toHaveValue(
    "#00ff00",
  );
  await expect.poll(pixels).not.toBe(before);
  await page.mouse.up();
  expect(await page.evaluate(() => localStorage.getItem("gradient-document"))).toBeNull();
  const edited = await pixels();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Couleurs 1 #27134f/ })).toBeVisible();
  await expect.poll(pixels).not.toBe(edited);
});

test("theme changes animate UI colors and new composition controls reach the GPU", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click(),
  );
  await page.getByRole("button", { name: "Paramètres généraux", exact: true }).click();
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.themeTransition === "true") {
        Reflect.set(window, "__themeAnimated", true);
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme-transition"],
    });
  });
  await page.getByRole("tab", { name: "Sombre", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "__themeAnimated"))).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const result = await page.evaluate(async () => {
    const url = "/lib/webgl.js";
    const { GradientRenderer } = await import(url);
    const canvas = document.createElement("canvas");
    const renderer = new GradientRenderer(canvas, {
      width: 96,
      height: 64,
      playing: false,
      config: { grain: 0 },
    });
    const gl = canvas.getContext("webgl")!;
    const read = () => {
      renderer.seek(0.75);
      const data = new Uint8Array(96 * 64 * 4);
      gl.readPixels(0, 0, 96, 64, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    };
    const defaults = {
      centerX: 0,
      centerY: 0,
      stretch: 1,
      twist: 0,
      contrast: 1,
      hueShift: 0,
      chromaticShift: 0,
    };
    const baseline = read();
    const changes = Object.entries({
      centerX: 0.8,
      centerY: -0.8,
      stretch: 2.5,
      twist: 2.5,
      contrast: 1.8,
      hueShift: 90,
      chromaticShift: 0.04,
    }).map(([key, value]) => {
      renderer.update({ ...defaults, [key]: value });
      return read().some((channel, index) => channel !== baseline[index]);
    });
    const error = gl.getError();
    renderer.destroy();
    return { changes, error };
  });
  expect(result.changes).toEqual(Array(7).fill(true));
  expect(result.error).toBe(0);
});
