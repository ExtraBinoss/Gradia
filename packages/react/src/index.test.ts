import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Gradient } from "./index";
import { DEFAULT_CONFIG } from "@plinka/gradient-core";
it("imports and renders the React adapter on the server without DOM or GPU access", () => {
  expect(typeof globalThis.document).toBe("undefined");
  const html = renderToStaticMarkup(
    createElement(Gradient, {
      config: DEFAULT_CONFIG,
      "aria-label": "Gradient",
      style: { width: "100%", height: 400 },
    }),
  );
  expect(html).toContain("<canvas");
  expect(html).toContain("height:400px");
  expect(html).toContain('aria-label="Gradient"');
});
