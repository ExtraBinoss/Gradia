import { test, expect } from "@playwright/test";
test("Code exports and copies the actual current preset in every format", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          Reflect.set(window, "__copiedCode", text);
        },
      },
    }),
  );
  await page.goto("/");
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".studio-intro button")?.click(),
  );
  const contrast = page.getByRole("textbox", { name: "Contraste — Réglages", exact: true });
  await contrast.fill("1.73");
  await contrast.blur();
  await page.getByRole("combobox", { name: "Style du shader", exact: true }).click();
  await page.getByRole("option", { name: "Silk", exact: true }).click();
  const expected = await page.evaluate(
    () => JSON.parse(localStorage.getItem("gradient-document")!).config,
  );
  await page.locator(".dock-actions").getByRole("button", { name: "Code", exact: true }).click();
  await expect(page.locator(".integration-preset strong")).toContainText("Daydream");
  await expect(page.locator("pre")).toContainText('"contrast": 1.73');
  await expect(page.locator("pre")).toContainText("gradia-react.min.js");
  await page.getByRole("tab", { name: "JSON", exact: true }).click();
  expect(JSON.parse(await page.locator("pre").innerText()).config).toEqual(expected);
  await page.getByRole("button", { name: "Copier le code", exact: true }).click();
  expect(JSON.parse(await page.evaluate(() => Reflect.get(window, "__copiedCode"))).config).toEqual(
    expected,
  );
  await page.getByRole("tab", { name: "JavaScript", exact: true }).click();
  await expect(page.locator("pre")).toContainText("pagehide");
  await expect(page.locator("pre")).not.toContainText("gradient.update(");
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  await expect(page.locator("pre")).toContainText("./gradient/webgl");
  await page.getByRole("button", { name: "Copier le prompt IA", exact: true }).click();
  const prompt = await page.evaluate(() => Reflect.get(window, "__copiedCode") as string);
  expect(prompt).toContain('"contrast": 1.73');
  expect(prompt).toContain('"style": "silk"');
  const kit = await page.request.get("/gradia-kit.zip");
  expect(kit.ok()).toBe(true);
});
test("the minified standalone module is self-contained and keeps a real gradient alive", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const url = "/lib/gradia.min.js";
    const { GradientRenderer, parseConfig, TextureBlendPass } = await import(url);
    const canvas = document.createElement("canvas");
    const config = parseConfig({ style: "silk", contrast: 1.73 });
    const renderer = new GradientRenderer(canvas, {
      config,
      width: 80,
      height: 64,
      playing: false,
    });
    renderer.seek(0.6);
    const gl = canvas.getContext("webgl")!;
    const data = new Uint8Array(80 * 64 * 4);
    gl.readPixels(0, 0, 80, 64, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const result = {
      nonuniform: new Set(data.filter((_, i) => i % 4 !== 3)).size,
      error: gl.getError(),
      blend: typeof TextureBlendPass,
    };
    renderer.destroy();
    return result;
  });
  expect(result.nonuniform).toBeGreaterThan(20);
  expect(result.error).toBe(0);
  expect(result.blend).toBe("function");
  const content = await (await page.request.get("/lib/gradia.min.js")).text();
  expect(content).not.toMatch(/from["']react/);
  expect(content).not.toContain("@plinka/");
});
