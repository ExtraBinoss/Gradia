import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
it("initial HTML exposes the English 1200×630 Gradia social card without JavaScript", async () => {
  const html = await readFile("apps/web/index.html", "utf8");
  const meta = new Map<string, string>();
  for (const tag of html.matchAll(/<meta\s+([^>]+)>/g)) {
    const attrs = Object.fromEntries(
      [...tag[1].matchAll(/([a-z:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
    );
    if (attrs.name || attrs.property) meta.set(attrs.name || attrs.property, attrs.content);
  }
  expect(meta.get("og:image")).toBe("https://gradia.plinka.eu/social/gradia.png");
  expect(meta.get("twitter:image")).toBe(meta.get("og:image"));
  expect(meta.get("og:locale")).toBe("en_US");
  expect(meta.get("og:image:width")).toBe("1200");
  expect(meta.get("og:image:height")).toBe("630");
  expect(meta.get("twitter:description")).toBe(meta.get("og:description"));
  const png = await readFile("apps/web/public/social/gradia.png");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  expect(await readFile("artwork/social/index.html", "utf8")).toContain('<html lang="en">');
});
