import { describe, expect, it } from "vitest";
import {
  effectTypes,
  effectFields,
  blendModes,
  compositeModes,
  MAX_EFFECTS,
  createEffect,
  parseEffect,
  parseEffects,
  parseConfig,
  mergeConfig,
  serializeConfig,
  deserializeConfig,
  randomizeConfig,
  generateVariations,
  commit,
  undo,
  redo,
  type PostEffect,
} from "./index";

describe("portable ordered effect boundary", () => {
  it("builds independent, deterministic nodes for every available effect", () => {
    expect(effectTypes).toEqual(["ascii", "dither", "blocks", "glass", "folds"]);
    expect(blendModes).toHaveLength(26);
    expect(compositeModes).toHaveLength(13);
    for (const type of effectTypes) {
      const a = createEffect(type),
        b = createEffect(type);
      expect(a).toEqual(b);
      expect(a.params).not.toBe(b.params);
      expect(a).toMatchObject({
        id: type,
        type,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
        composite: "source-over",
        scaleMode: "relative",
      });
      expect(parseEffect(a)).toEqual(a);
    }
    const a = parseConfig({}),
      b = parseConfig({});
    expect(a.effects).toEqual([]);
    expect(a.effects).not.toBe(b.effects);
  });
  it("accepts every compositor enum, rejects unknown ones, and clamps opacity", () => {
    for (const blendMode of blendModes)
      expect(parseEffect({ type: "blocks", blendMode }).blendMode).toBe(blendMode);
    for (const composite of compositeModes)
      expect(parseEffect({ type: "glass", composite }).composite).toBe(composite);
    expect(
      parseEffect({ type: "folds", opacity: -4, scaleMode: "pixels", enabled: false }).opacity,
    ).toBe(0);
    expect(parseEffect({ type: "blocks", opacity: 5 }).opacity).toBe(1);
    for (const patch of [
      { blendMode: "bad" },
      { composite: "bad" },
      { scaleMode: "bad" },
      { opacity: NaN },
      { opacity: "1" },
      { opacity: null },
      { enabled: "true" },
      { enabled: null },
    ])
      expect(() => parseEffect({ type: "ascii", ...patch })).toThrow();
  });
  it("rejects malformed nodes and unstable or duplicate IDs", () => {
    for (const input of [null, [], 4, false, "ascii", {}, { type: "gradient" }, { type: "bad" }])
      expect(() => parseEffect(input)).toThrow();
    for (const id of ["", " ", "gradient", "x".repeat(81), "a\nb", "a\u007fb", "a\u0085b", 4, null])
      expect(() => parseEffect({ type: "ascii", id })).toThrow();
    expect(parseEffect({ type: "ascii", id: "custom-7" }).id).toBe("custom-7");
    expect(() => parseEffects({})).toThrow();
    expect(() =>
      parseEffects(
        Array.from({ length: MAX_EFFECTS + 1 }, (_, index) =>
          createEffect("blocks", `node-${index}`),
        ),
      ),
    ).toThrow();
    expect(() =>
      parseEffects([createEffect("ascii", "same"), createEffect("glass", "same")]),
    ).toThrow();
    expect(
      parseEffects(
        Array.from({ length: MAX_EFFECTS }, (_, index) => createEffect("blocks", `node-${index}`)),
      ),
    ).toHaveLength(MAX_EFFECTS);
  });
  it("validates every numeric parameter and keeps enum, boolean, color and glyph contracts", () => {
    for (const type of effectTypes)
      for (const [key, field] of Object.entries(effectFields[type])) {
        const read = (value: unknown) =>
          parseEffect({ type, params: { [key]: value } }).params as unknown as Record<
            string,
            unknown
          >;
        if (field.kind === "number") {
          expect(read(field.min - 100)[key]).toBe(field.min);
          expect(read(field.max + 100)[key]).toBe(field.max);
          for (const value of [NaN, Infinity, "1", null]) expect(() => read(value)).toThrow();
        } else if (field.kind === "boolean") {
          expect(read(false)[key]).toBe(false);
          expect(() => read("yes")).toThrow();
        } else if (field.kind === "color") {
          expect(read("#aAbBcC")[key]).toBe("#aAbBcC");
          for (const value of [null, 4, "red", "#fff"]) expect(() => read(value)).toThrow();
        } else if (field.kind === "select") {
          for (const option of field.options) expect(read(option)[key]).toBe(option);
          expect(() => read("bad")).toThrow();
        } else {
          expect(read(" .AB")[key]).toBe(" .AB");
          for (const value of [4, "a", "", "a\nb", "éé", "x".repeat(33)])
            expect(() => read(value)).toThrow();
        }
      }
    expect(parseEffect({ type: "dither", params: { levels: 4.7 } }).params).toHaveProperty(
      "levels",
      5,
    );
    for (const params of [null, 4, [], "bad"])
      expect(() => parseEffect({ type: "blocks", params })).toThrow();
  });
});
describe("versioned stack migration and updates", () => {
  it("migrates legacy ASCII and dithering without losing their appearance preferences", () => {
    const ascii = deserializeConfig(
      JSON.stringify({
        version: 1,
        config: {
          effect: "ascii",
          asciiSize: 27,
          asciiCharacters: " .01#",
          asciiColored: false,
          asciiInvert: true,
          asciiColor: "#abcdef",
          backgroundColor: "#123456",
        },
      }),
    );
    expect(ascii.effects).toEqual([
      {
        ...createEffect("ascii", "legacy-ascii"),
        scaleMode: "pixels",
        params: {
          size: 27,
          characters: " .01#",
          colored: false,
          invert: true,
          foreground: "#abcdef",
          background: "#123456",
          backgroundOpacity: 1,
        },
      },
    ]);
    const dither = parseConfig({
      effect: "dither",
      ditherPattern: "noise",
      ditherSize: 5,
      ditherLevels: 9,
      ditherStrength: 0.4,
      ditherMonochrome: true,
    });
    expect(dither.effects[0]).toMatchObject({
      type: "dither",
      scaleMode: "pixels",
      params: { pattern: "noise", size: 5, levels: 9, strength: 0.4, monochrome: true },
    });
    expect(parseConfig({ effect: "ascii", effects: [] }).effect).toBe("gradient");
    expect(parseConfig({ effects: [createEffect("blocks")] }).effect).toBe("gradient");
  });
  it("round-trips a v2 stack in exact order, including repeated independent effect types", () => {
    const effects: PostEffect[] = [
      createEffect("blocks", "mosaic"),
      { ...createEffect("ascii", "text"), opacity: 0.7, blendMode: "screen" },
      { ...createEffect("ascii", "second-text"), enabled: false },
      createEffect("dither"),
    ];
    const config = parseConfig({ effects });
    const json = serializeConfig(config);
    expect(JSON.parse(json).version).toBe(2);
    expect(deserializeConfig(json)).toEqual(config);
    expect(config.effects.map((effect) => effect.id)).toEqual([
      "mosaic",
      "text",
      "second-text",
      "dither",
    ]);
    expect(config.effects).not.toBe(effects);
    expect(config.effects[0].params).not.toBe(effects[0].params);
    expect(config.effect).toBe("dither");
    const disabled = parseConfig({
      effects: [
        { ...createEffect("ascii"), enabled: false },
        { ...createEffect("dither"), enabled: false },
      ],
    });
    expect(disabled.effect).toBe("gradient");
  });
  it("supports legacy update aliases while giving a canonical stack priority", () => {
    const start = parseConfig({
      effects: [
        createEffect("blocks"),
        createEffect("ascii", "a"),
        createEffect("ascii", "b"),
        createEffect("dither"),
      ],
    });
    const changed = mergeConfig(start, {
      asciiSize: 25,
      asciiCharacters: " .AB",
      asciiColored: false,
      asciiInvert: true,
      asciiColor: "#112233",
      backgroundColor: "#445566",
      ditherPattern: "noise",
      ditherLevels: 7,
      ditherSize: 4,
      ditherStrength: 0.3,
      ditherMonochrome: true,
    });
    expect(changed.effects[1]).toEqual(start.effects[1]);
    expect(changed.effects[2]).toMatchObject({
      params: {
        size: 25,
        characters: " .AB",
        colored: false,
        invert: true,
        foreground: "#112233",
        background: "#445566",
      },
    });
    expect(changed.effects[3]).toMatchObject({
      params: { pattern: "noise", levels: 7, size: 4, strength: 0.3, monochrome: true },
    });
    expect(mergeConfig(start, { effect: "gradient" }).effects).toEqual([]);
    expect(mergeConfig(start, { effect: "dither", ditherSize: 6 }).effects).toHaveLength(1);
    expect(mergeConfig(start, { effects: [], effect: "ascii" }).effects).toEqual([]);
    expect(mergeConfig(parseConfig({}), { asciiSize: 29 }).effects).toEqual([]);
    expect(mergeConfig(start, { rotation: 84 }).effects).toEqual(start.effects);
    expect(() => mergeConfig(start, { asciiSize: NaN })).toThrow();
  });
  it("preserves the independent stack through randomization, suggestions and history", () => {
    const initial = parseConfig({
      effects: [createEffect("blocks"), createEffect("glass"), createEffect("folds")],
    });
    const before = JSON.stringify(initial);
    expect(randomizeConfig(initial, 43).effects).toEqual(initial.effects);
    expect(
      generateVariations(initial, 43).every(
        (config) => JSON.stringify(config.effects) === JSON.stringify(initial.effects),
      ),
    ).toBe(true);
    const next = parseConfig({ ...initial, effects: [...initial.effects].reverse() });
    const history = commit({ past: [], present: initial, future: [] }, next);
    expect(undo(history).present).toEqual(initial);
    expect(redo(undo(history)).present).toEqual(next);
    expect(JSON.stringify(initial)).toBe(before);
  });
});
