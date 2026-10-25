import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function openSettings(page: import("@playwright/test").Page) {
  await expect(page.locator(".settings-float")).toBeVisible();
}
async function choose(page: import("@playwright/test").Page, label: string, value: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("fullscreen studio, independent shader styles, effects, and history preserve the canvas", async ({
  page,
}) => {
  await openSettings(page);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const canvas = page.getByTestId("gradient-canvas");
  expect(await canvas.evaluate((c) => [c.clientWidth, c.clientHeight])).toEqual([1280, 720]);
  await canvas.evaluate((c) => c.setAttribute("data-instance", "same"));
  for (const name of ["Silk", "Aurora", "Liquid", "Radial", "Waves", "Mesh"])
    await choose(page, "Style du shader", name);
  await page.getByRole("tab", { name: "ASCII", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Couleurs du gradient" })).toBeVisible();
  await page.getByRole("tab", { name: "Dither", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Duotone" })).toBeVisible();
  await expect(canvas).toHaveAttribute("data-instance", "same");
  await expect(page.getByRole("button", { name: "Annuler", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rétablir", exact: true })).toBeEnabled();
});
test("color preview cancels on Escape and drag reorder commits stable color IDs", async ({
  page,
}) => {
  await openSettings(page);
  await page.getByRole("button", { name: /Couleurs 1 #/ }).click();
  const stored = await page.evaluate(() => localStorage.getItem("gradient-document"));
  await page.getByRole("textbox", { name: "Couleurs 1", exact: true }).fill("#123456");
  expect(await page.evaluate(() => localStorage.getItem("gradient-document"))).toBe(stored);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Couleurs 1 #27134f/ })).toBeVisible();
  const handle = page.getByRole("button", { name: "Déplacer la couleur color-0", exact: true });
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status")).toContainText("color-1");
  await page.keyboard.press("Space");
  await expect(handle).not.toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("gradient-document") || "{}").config?.colors[1]?.id,
      ),
    )
    .toBe("color-0");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByRole("button", { name: /Couleurs 1 #27134f/ })).toBeVisible();
});
test("custom aspect ratios fit the screen precisely and timeline seeks deterministically", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Format", exact: true }).click();
  await page.getByRole("button", { name: "9:16", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.getByTestId("gradient-canvas").evaluate((c) => c.clientWidth / c.clientHeight))
    .toBeCloseTo(9 / 16, 2);
  await page.getByRole("button", { name: "Format", exact: true }).click();
  await page.getByRole("textbox", { name: "Largeur", exact: true }).fill("1200");
  await page.getByRole("textbox", { name: "Hauteur", exact: true }).fill("500");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.getByTestId("gradient-canvas").evaluate((c) => c.clientWidth / c.clientHeight))
    .toBeCloseTo(2.4, 2);
  const timeline = page.getByRole("slider", { name: "Timeline", exact: true });
  await timeline.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Lire", exact: true })).toBeVisible();
  await expect.poll(async () => Number(await timeline.inputValue())).toBeCloseTo(1 / 60, 3);
});
test("variations and named presets have independent previews and durable saves", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Autres variations", exact: true }).hover();
  await expect(page.locator("button.variation-card")).toHaveCount(4);
  await page.locator("button.variation-card").nth(1).click();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("textbox", { name: "Nom du preset", exact: true }).fill("My gradient");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Preset My gradient", exact: true })).toBeVisible();
  const image = page
    .getByRole("button", { name: "Preset My gradient", exact: true })
    .locator("img");
  await expect(image).toHaveAttribute("src", /^data:image\/webp;base64,/);
  expect(await image.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(320);
  await page.reload();
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nom du preset", exact: true })).toHaveValue(
    "My gradient",
  );
  await expect(
    page.getByRole("button", { name: "Preset My gradient", exact: true }),
  ).toHaveAttribute("aria-current", "true");
});
test("portable React kit and versioned configuration export/import", async ({ page }) => {
  await page.locator(".dock-actions").getByRole("button", { name: "Code", exact: true }).click();
  await expect(page.locator("pre")).toContainText(
    "import { Gradient } from './gradia/min-js/gradia-react.min.js'",
  );
  const kit = await page.request.get("/gradia-kit.zip");
  expect(kit.ok()).toBe(true);
  expect((await kit.body()).subarray(0, 2).toString()).toBe("PK");
  await page.keyboard.press("Escape");
  await page
    .locator(".dock-actions")
    .getByRole("button", { name: "Exporter", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger la configuration", exact: true }).click();
  const download = await pending;
  const json = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(json.version).toBe(1);
  expect(json.config.loopDuration).toBe(8);
  json.config.style = "silk";
  json.config.effect = "ascii";
  await page.locator("input[type=file]").setInputFiles({
    name: "gradient.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(json)),
  });
  await openSettings(page);
  await expect(page.getByRole("tab", { name: "ASCII", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
test("glass survives production CSS, dark mode, and narrow viewports", async ({ page }) => {
  await expect(page.getByRole("banner")).toHaveCSS("backdrop-filter", "blur(20px) saturate(1.6)");
  await page.getByRole("button", { name: "Paramètres généraux", exact: true }).click();
  await page.getByRole("tab", { name: "Sombre", exact: true }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await choose(page, "Langue", "English");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "ASCII", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Gradient colors" })).toBeVisible();
});
test("reduced motion and missing WebGL produce usable states", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.getByRole("button", { name: "Lire", exact: true })).toBeVisible();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("WebGL est indisponible");
});

test("double-click reset animates, duration starts at one, and properties stay open", async ({
  page,
}) => {
  await openSettings(page);
  const input = page.getByRole("textbox", { name: "Amplitude — Réglages", exact: true });
  await input.fill("8");
  await input.blur();
  await expect(input).toHaveValue("8");
  await page
    .locator(".control-label label")
    .filter({ hasText: /^Amplitude$/ })
    .dblclick();
  await expect(input).toHaveValue("3.5");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(input).toHaveValue("8");
  const buttons = page.getByRole("button", { name: "Masquer les réglages", exact: true });
  await expect(buttons).toHaveCount(0);
  expect(
    await page
      .locator(".settings-float")
      .evaluate((el) => Math.round(el.getBoundingClientRect().height)),
  ).toBe(688);
  await page.getByRole("button", { name: "Durée de la boucle", exact: true }).click();
  const duration = page.getByRole("textbox", {
    name: "Durée de la boucle — Réglages",
    exact: true,
  });
  await duration.fill("1");
  await duration.blur();
  await expect(duration).toHaveValue("1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("slider", { name: "Timeline", exact: true })).toHaveAttribute(
    "max",
    "1",
  );
  await expect(page.locator(".settings-float")).toBeVisible();
});

test("generated variations and templates retain their preview across the gaps", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Autres variations", exact: true }).hover();
  const cards = page.locator("button.variation-card");
  await expect(cards).toHaveCount(4);
  const first = await cards.first().boundingBox();
  const second = await cards.nth(1).boundingBox();
  await cards.first().hover();
  const amplitude = page.getByRole("textbox", { name: "Amplitude — Réglages", exact: true });
  const previewValue = await amplitude.inputValue();
  await page.mouse.move((first!.x + first!.width + second!.x) / 2, first!.y + 25);
  await expect(amplitude).toHaveValue(previewValue);
  const originalImages = await cards
    .locator("img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  await page.getByRole("button", { name: "Nouvelles variations", exact: true }).click();
  await expect(page.locator(".variation-grid")).toHaveAttribute("aria-busy", "false");
  await expect(cards).toHaveCount(4);
  const newImages = await cards
    .locator("img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  expect(newImages).not.toEqual(originalImages);
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await page.getByRole("tab", { name: "Modèles", exact: true }).click();
  await expect(page.locator(".template-card")).toHaveCount(32);
  const silk = page.getByRole("button", { name: "Template Silk", exact: true });
  await silk.hover();
  await expect(page.getByRole("combobox", { name: "Style du shader", exact: true })).toContainText(
    "Silk",
  );
  const templateBox = await silk.boundingBox();
  await page.mouse.move(templateBox!.x + templateBox!.width + 4, templateBox!.y + 25);
  await expect(page.getByRole("combobox", { name: "Style du shader", exact: true })).toContainText(
    "Silk",
  );
});

test("timeline shares one axis and its tools live in a separate pill", async ({ page }) => {
  const timeline = page.getByRole("slider", { name: "Timeline", exact: true });
  await timeline.focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowRight");
  const offsets = await page.evaluate(() => {
    const head = document.querySelector(".timeline-playhead")!.getBoundingClientRect();
    const fill = document.querySelector(".timeline-progress")!.getBoundingClientRect();
    const track = document
      .querySelector('.timeline-track [data-slot="slider-track"]')!
      .getBoundingClientRect();
    return {
      x: Math.abs(head.x + head.width / 2 - fill.right),
      y: Math.abs(head.y + head.height / 2 - track.y - track.height / 2),
    };
  });
  expect(offsets.x).toBeLessThan(0.6);
  expect(offsets.y).toBeLessThan(0.6);
  await expect(page.locator(".timeline-pill").getByRole("button")).toHaveCount(2);
  await expect(
    page.locator(".tools-pill").getByRole("button", { name: "Exporter", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".history-pill").getByRole("button", { name: "Annuler", exact: true }),
  ).toBeVisible();
});
test("saved library loads more than thirty real previews without a preset cap", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Enregistrer un preset", exact: true }).click();
  await expect(page.locator(".notification")).toContainText("Preset enregistré");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("plinka-gradient-studio", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const base = await new Promise<Record<string, unknown>>((resolve) => {
      const r = db.transaction("presets").objectStore("presets").openCursor();
      r.onsuccess = () => resolve(r.result!.value);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("presets", "readwrite");
      for (let i = 0; i < 45; i++)
        tx.objectStore("presets").put({
          ...base,
          id: `many-${i}`,
          name: `Saved ${i}`,
          updatedAt: Date.now() + i,
        });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.getByRole("button", { name: "Presets", exact: true }).click();
  await expect(page.locator(".saved-heading")).toContainText("46");
  await expect(page.locator(".saved-preset-row")).toHaveCount(20);
  await page.locator(".saved-preset-list").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect.poll(() => page.locator(".saved-preset-row").count()).toBeGreaterThanOrEqual(40);
  await page.locator(".saved-preset-list").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.locator(".saved-preset-row")).toHaveCount(46);
});
