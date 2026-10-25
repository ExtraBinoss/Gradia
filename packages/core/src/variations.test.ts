import { it, expect } from "vitest";
import { generateVariations, parseConfig } from "./index";
it("generates exactly four deterministic independent variations from the current design", () => {
  const base = parseConfig({ effect: "ascii", loopDuration: 6 });
  const before = JSON.stringify(base);
  const first = generateVariations(base, 42);
  expect(first).toHaveLength(4);
  expect(first).toEqual(generateVariations(base, 42));
  expect(first).not.toEqual(generateVariations(base, 43));
  expect(new Set(first.map((value) => JSON.stringify(value))).size).toBe(4);
  for (const config of first) {
    expect(parseConfig(config)).toEqual(config);
    expect(config.effect).toBe("ascii");
    expect(config.loopDuration).toBe(6);
  }
  expect(JSON.stringify(base)).toBe(before);
});
