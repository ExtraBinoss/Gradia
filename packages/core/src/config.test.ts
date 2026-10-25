import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  parseConfig,
  isHex,
  hexToRgb,
  serializeConfig,
  deserializeConfig,
  randomizeConfig,
  ranges,
  presets,
  commit,
  undo,
  redo,
  type History,
} from "./index";
describe("configuration boundary", () => {
  it("normalizes defaults without sharing mutable colors", () => {
    const a = parseConfig({}),
      b = parseConfig({});
    expect(a).toEqual(DEFAULT_CONFIG);
    expect(a.colors).not.toBe(b.colors);
    expect(isHex("#ffeedd")).toBe(true);
    expect(isHex("#xyzxyz")).toBe(false);
    expect(isHex(null)).toBe(false);
  });
  it("enforces finite bounds for every numeric parameter", () => {
    for (const [key, [min, max]] of Object.entries(ranges)) {
      expect(parseConfig({ [key]: min - 100 })[key as keyof typeof ranges]).toBe(min);
      expect(parseConfig({ [key]: max + 100 })[key as keyof typeof ranges]).toBe(max);
      expect(() => parseConfig({ [key]: NaN })).toThrow();
      expect(() => parseConfig({ [key]: Infinity })).toThrow();
      expect(() => parseConfig({ [key]: "2" })).toThrow();
    }
  });
  it("rejects non-documents", () => {
    for (const input of [null, [], false, 42, ""]) expect(() => parseConfig(input)).toThrow();
  });
  it("validates booleans", () => {
    for (const key of ["asciiColored", "asciiInvert", "ditherMonochrome"]) {
      expect(() => parseConfig({ [key]: "true" })).toThrow();
      expect(parseConfig({ [key]: false })[key as "asciiColored"]).toBe(false);
    }
  });
  it("validates independent shader styles", () => {
    for (const style of ["mesh", "silk", "aurora", "liquid", "radial", "waves"])
      expect(parseConfig({ style }).style).toBe(style);
    expect(() => parseConfig({ style: "unknown" })).toThrow();
  });
  it("validates effect and pattern enums", () => {
    for (const effect of ["gradient", "ascii", "dither"])
      expect(parseConfig({ effect }).effect).toBe(effect);
    for (const ditherPattern of ["bayer4", "bayer8", "noise"])
      expect(parseConfig({ ditherPattern }).ditherPattern).toBe(ditherPattern);
    expect(() => parseConfig({ effect: "bad" })).toThrow();
    expect(() => parseConfig({ ditherPattern: "bad" })).toThrow();
  });
  it("validates foreground and background", () => {
    for (const key of ["asciiColor", "backgroundColor"]) {
      expect(() => parseConfig({ [key]: "#fff" })).toThrow();
      expect(parseConfig({ [key]: "#aAbBcC" })[key as "asciiColor"]).toBe("#aAbBcC");
    }
  });
  it("limits glyph atlas to printable ASCII", () => {
    for (const asciiCharacters of [1, "", "a", "x".repeat(33), "你好", "a\nb"])
      expect(() => parseConfig({ asciiCharacters })).toThrow();
    expect(parseConfig({ asciiCharacters: " .01@" }).asciiCharacters).toBe(" .01@");
  });
  it("validates color count, shape, IDs, and active colors", () => {
    const pair = [{ color: "#ffffff" }, { color: "#000000" }];
    expect(parseConfig({ colors: pair }).colors[0]).toEqual({
      id: "color-0",
      color: "#ffffff",
      enabled: true,
      influence: 1,
    });
    for (const colors of [
      {},
      [],
      [pair[0]],
      Array(7).fill(pair[0]),
      [null, pair[0]],
      [{ color: "red" }, pair[0]],
      [{ color: "#ffffff", enabled: "yes" }, pair[0]],
      [{ color: "#ffffff", influence: NaN }, pair[0]],
      [{ color: "#ffffff", influence: "1" }, pair[0]],
      [
        { color: "#ffffff", id: "same" },
        { color: "#000000", id: "same" },
      ],
      pair.map((c) => ({ ...c, enabled: false })),
    ])
      expect(() => parseConfig({ colors })).toThrow();
    const clamped = parseConfig({
      colors: [
        { ...pair[0], influence: -9, id: "x".repeat(100) },
        { ...pair[1], influence: 9, id: "custom" },
      ],
    });
    expect(clamped.colors.map((c) => c.influence)).toEqual([0, 2]);
    expect(clamped.colors[0].id).toBe("color-0");
    expect(clamped.colors[1].id).toBe("custom");
  });
  it("round-trips a versioned document and refuses unknown versions", () => {
    const json = serializeConfig(DEFAULT_CONFIG);
    expect(deserializeConfig(json)).toEqual(DEFAULT_CONFIG);
    for (const raw of [
      "{}",
      "[]",
      "null",
      "not json",
      '{"version":3,"config":{}}',
      '{"version":1}',
      "x".repeat(65537),
    ])
      expect(() => deserializeConfig(raw)).toThrow();
  });
  it("converts hex to normalized channels", () => {
    expect(hexToRgb("#ff0080")).toEqual([1, 0, 128 / 255]);
    expect(() => hexToRgb("bad")).toThrow();
  });
});
describe("presets and seeded composition", () => {
  it("ships independent, valid presets with each supported effect", () => {
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
    expect(new Set(presets.map((p) => p.config.effect)).size).toBe(3);
    for (const p of presets) expect(parseConfig(p.config)).toEqual(p.config);
  });
  it("randomizes deterministically while retaining effect preferences", () => {
    const config = parseConfig({ effect: "ascii" });
    const a = randomizeConfig(config, 31),
      b = randomizeConfig(config, 31);
    expect(a).toEqual(b);
    expect(a).not.toEqual(randomizeConfig(config, 32));
    expect(a.effect).toBe("ascii");
    expect(a.asciiSize).toBe(config.asciiSize);
    expect(a.colors.map((c) => c.id)).toEqual(config.colors.map((c) => c.id));
    expect(parseConfig(a)).toEqual(a);
  });
});
describe("bounded transactional history", () => {
  const start = (): History => ({ past: [], present: parseConfig({}), future: [] });
  it("ignores unchanged commits and empty navigation", () => {
    const h = start();
    expect(commit(h, parseConfig({}))).toBe(h);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
  it("undoes and redoes a committed change, clearing stale redo", () => {
    const h = start(),
      changed = parseConfig({ speed: 9 }),
      a = commit(h, changed);
    expect(undo(a).present).toEqual(h.present);
    expect(redo(undo(a)).present).toEqual(changed);
    expect(commit(undo(a), parseConfig({ speed: 7 })).future).toHaveLength(0);
  });
  it("caps history at 50 transactions", () => {
    let h = start();
    for (let i = 0; i < 70; i++) h = commit(h, parseConfig({ seed: i }));
    expect(h.past).toHaveLength(50);
  });
});
