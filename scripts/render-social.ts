import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { execFileSync } from "node:child_process";
const root = resolve("artwork/social");
const types: Record<string, string> = {
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const server = createServer((request, response) => {
  void (async () => {
    const path = resolve(
      root,
      "." + decodeURIComponent(new URL(request.url!, "http://localhost").pathname),
    );
    if (path !== root && !path.startsWith(root + "/")) {
      response.writeHead(403).end();
      return;
    }
    try {
      const file = path === root ? resolve(root, "index.html") : path;
      response.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  })();
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    locale: "en-US",
    colorScheme: "light",
  });
  const address = server.address() as { port: number };
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
  });
  await mkdir("apps/web/public/social", { recursive: true });
  await page.screenshot({
    path: "apps/web/public/social/gradia.png",
    type: "png",
    animations: "disabled",
  });
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    "apps/web/public/social/gradia.png",
    "-c:v",
    "libwebp",
    "-quality",
    "92",
    "apps/web/public/social/gradia.webp",
  ]);
  await writeFile(
    "docs/media/gradia-poster.webp",
    await readFile("apps/web/public/social/gradia.webp"),
  );
  console.log("Gradia social card rendered: 1200×630, en-US, light theme, real product assets.");
} finally {
  await browser.close();
  server.close();
}
