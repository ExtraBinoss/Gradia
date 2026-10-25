import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Input, ALL_FORMATS, BlobSource } from "mediabunny";
test("Mediabunny exports a complete deterministic two-second loop", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  const available = await page.evaluate(() => typeof VideoEncoder !== "undefined");
  if (!available) {
    test.skip(true, "WebCodecs encoding unavailable in this browser");
    return;
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Durée de la boucle", exact: true }).click();
  await page.getByRole("textbox", { name: "Durée de la boucle — Réglages", exact: true }).fill("2");
  await page.getByRole("textbox", { name: "Durée de la boucle — Réglages", exact: true }).blur();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Exporter la vidéo", exact: true }).click();
  await page.getByRole("combobox", { name: "Résolution", exact: true }).click();
  await page.getByRole("option", { name: "720px", exact: true }).click();
  await page.getByRole("combobox", { name: "Images par seconde", exact: true }).click();
  await page.getByRole("option", { name: "24 fps", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .locator(".record-popover")
    .getByRole("button", { name: "Exporter la vidéo", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/-2s.webm$/);
  const data = await readFile((await download.path())!);
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(new Blob([new Uint8Array(data)])),
  });
  try {
    expect(await input.computeDuration()).toBeCloseTo(2, 2);
    const track = await input.getPrimaryVideoTrack();
    expect(track).not.toBeNull();
    expect(await track!.getDisplayWidth()).toBe(720);
    const stats = await track!.computePacketStats();
    expect(stats.packetCount).toBe(48);
  } finally {
    input.dispose();
  }
});
