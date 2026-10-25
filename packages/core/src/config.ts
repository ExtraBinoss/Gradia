import { createEffect, parseEffect, parseEffects, type PostEffect } from "./effects";
export type ShaderStyle = "mesh" | "silk" | "aurora" | "liquid" | "radial" | "waves";
export type Effect = "gradient" | "ascii" | "dither";
export type DitherPattern = "bayer4" | "bayer8" | "noise";
export interface GradientColor {
  id: string;
  color: string;
  enabled: boolean;
  influence: number;
}
export interface GradientConfig {
  style: ShaderStyle;
  colors: GradientColor[];
  seed: number;
  speed: number;
  loopDuration: number;
  scale: number;
  rotation: number;
  centerX: number;
  centerY: number;
  stretch: number;
  twist: number;
  contrast: number;
  hueShift: number;
  chromaticShift: number;
  waveAmplitude: number;
  waveFrequencyX: number;
  waveFrequencyY: number;
  colorBlending: number;
  horizontalPressure: number;
  verticalPressure: number;
  flow: number;
  brightness: number;
  saturation: number;
  shadows: number;
  highlights: number;
  grain: number;
  grainScale: number;
  vignette: number;
  /** Ordered post-processing. The gradient remains the implicit source. */
  effects: PostEffect[];
  /** @deprecated Prefer effects. Accepted for v1 and update() compatibility. */
  effect: Effect;
  asciiSize: number;
  asciiCharacters: string;
  asciiColored: boolean;
  asciiInvert: boolean;
  asciiColor: string;
  backgroundColor: string;
  ditherPattern: DitherPattern;
  ditherSize: number;
  ditherLevels: number;
  ditherStrength: number;
  ditherMonochrome: boolean;
}

export const ranges = {
  seed: [0, 99999],
  speed: [0, 10],
  loopDuration: [1, 30],
  scale: [0.3, 4],
  rotation: [0, 360],
  centerX: [-1, 1],
  centerY: [-1, 1],
  stretch: [0.25, 3],
  twist: [-3, 3],
  contrast: [0.25, 2.5],
  hueShift: [-180, 180],
  chromaticShift: [0, 0.04],
  waveAmplitude: [0, 10],
  waveFrequencyX: [0, 10],
  waveFrequencyY: [0, 10],
  colorBlending: [0.2, 10],
  horizontalPressure: [0.5, 10],
  verticalPressure: [0.5, 10],
  flow: [0, 3],
  brightness: [0.2, 2],
  saturation: [0, 2],
  shadows: [0, 10],
  highlights: [0, 10],
  grain: [0, 1],
  grainScale: [0.5, 5],
  vignette: [0, 1],
  asciiSize: [5, 40],
  ditherSize: [1, 12],
  ditherLevels: [2, 16],
  ditherStrength: [0, 1],
} as const satisfies Partial<Record<keyof GradientConfig, readonly [number, number]>>;
export type NumericParameter = keyof typeof ranges;

export const DEFAULT_CONFIG: GradientConfig = {
  style: "mesh",
  colors: ["#27134f", "#6638e8", "#ef879b", "#ffad72", "#fce5c6"].map((color, i) => ({
    id: `color-${i}`,
    color,
    enabled: true,
    influence: 1,
  })),
  seed: 42,
  speed: 2,
  loopDuration: 8,
  scale: 1,
  rotation: 35,
  centerX: 0,
  centerY: 0,
  stretch: 1,
  twist: 0,
  contrast: 1,
  hueShift: 0,
  chromaticShift: 0,
  waveAmplitude: 3.5,
  waveFrequencyX: 3.2,
  waveFrequencyY: 2.4,
  colorBlending: 5,
  horizontalPressure: 3.5,
  verticalPressure: 3.5,
  flow: 0.6,
  brightness: 1.08,
  saturation: 1.1,
  shadows: 2,
  highlights: 2.5,
  grain: 0.08,
  grainScale: 1,
  vignette: 0.12,
  effects: [],
  effect: "gradient",
  asciiSize: 10,
  asciiCharacters: " .:-=+*#%@",
  asciiColored: true,
  asciiInvert: false,
  asciiColor: "#d6e7ff",
  backgroundColor: "#10111a",
  ditherPattern: "bayer4",
  ditherSize: 2,
  ditherLevels: 4,
  ditherStrength: 1,
  ditherMonochrome: false,
};

export function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}

/** Strict at storage/import boundaries. No DOM, UI, time or random globals. */
export function parseConfig(input: unknown): GradientConfig {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("INVALID_CONFIG");
  const source = input as Record<string, unknown>;
  const result = { ...DEFAULT_CONFIG, colors: DEFAULT_CONFIG.colors.map((c) => ({ ...c })) };
  for (const key of Object.keys(ranges) as NumericParameter[]) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`INVALID_${key}`);
    const [min, max] = ranges[key];
    result[key] = Math.max(min, Math.min(max, value));
  }
  result.seed = Math.round(result.seed);
  result.speed = Math.round(result.speed);
  result.loopDuration = Math.round(result.loopDuration);
  result.ditherLevels = Math.round(result.ditherLevels);
  for (const key of ["asciiColored", "asciiInvert", "ditherMonochrome"] as const) {
    if (source[key] !== undefined) {
      if (typeof source[key] !== "boolean") throw new Error(`INVALID_${key}`);
      result[key] = source[key];
    }
  }
  for (const key of ["asciiColor", "backgroundColor"] as const) {
    if (source[key] !== undefined) {
      if (!isHex(source[key])) throw new Error(`INVALID_${key}`);
      result[key] = source[key];
    }
  }
  if (source.style !== undefined) {
    if (!["mesh", "silk", "aurora", "liquid", "radial", "waves"].includes(source.style as string))
      throw new Error("INVALID_STYLE");
    result.style = source.style as ShaderStyle;
  }
  if (source.effect !== undefined) {
    if (!["gradient", "ascii", "dither"].includes(source.effect as string))
      throw new Error("INVALID_EFFECT");
    result.effect = source.effect as Effect;
  }
  if (source.ditherPattern !== undefined) {
    if (!["bayer4", "bayer8", "noise"].includes(source.ditherPattern as string))
      throw new Error("INVALID_PATTERN");
    result.ditherPattern = source.ditherPattern as DitherPattern;
  }
  if (source.asciiCharacters !== undefined) {
    if (
      typeof source.asciiCharacters !== "string" ||
      source.asciiCharacters.length < 2 ||
      source.asciiCharacters.length > 32 ||
      /[^\x20-\x7e]/.test(source.asciiCharacters)
    )
      throw new Error("INVALID_CHARACTERS");
    result.asciiCharacters = source.asciiCharacters;
  }
  if (source.colors !== undefined) {
    if (!Array.isArray(source.colors) || source.colors.length < 2 || source.colors.length > 6)
      throw new Error("INVALID_COLORS");
    const ids = new Set<string>();
    result.colors = source.colors.map((raw, i) => {
      if (!raw || typeof raw !== "object" || !isHex(raw.color)) throw new Error("INVALID_COLOR");
      if (raw.enabled !== undefined && typeof raw.enabled !== "boolean")
        throw new Error("INVALID_COLOR");
      if (
        raw.influence !== undefined &&
        (typeof raw.influence !== "number" || !Number.isFinite(raw.influence))
      )
        throw new Error("INVALID_COLOR");
      const id = typeof raw.id === "string" && raw.id.length < 80 ? raw.id : `color-${i}`;
      if (ids.has(id)) throw new Error("DUPLICATE_COLOR_ID");
      ids.add(id);
      return {
        id,
        color: raw.color,
        enabled: raw.enabled ?? true,
        influence: Math.max(0, Math.min(2, raw.influence ?? 1)),
      };
    });
    if (!result.colors.some((c) => c.enabled)) throw new Error("NO_ACTIVE_COLOR");
  }
  // A canonical stack always wins over legacy aliases, including an empty stack.
  result.effects =
    source.effects === undefined
      ? result.effect === "gradient"
        ? []
        : [fromLegacy(result, result.effect)]
      : parseEffects(source.effects);
  synchronizeLegacy(result);
  return result;
}

function fromLegacy(config: GradientConfig, type: "ascii" | "dither"): PostEffect {
  const effect = createEffect(type, `legacy-${type}`);
  return parseEffect({
    ...effect,
    scaleMode: "pixels",
    params:
      type === "ascii"
        ? {
            size: config.asciiSize,
            characters: config.asciiCharacters,
            colored: config.asciiColored,
            invert: config.asciiInvert,
            foreground: config.asciiColor,
            background: config.backgroundColor,
            backgroundOpacity: 1,
          }
        : {
            size: config.ditherSize,
            levels: config.ditherLevels,
            strength: config.ditherStrength,
            pattern: config.ditherPattern,
            monochrome: config.ditherMonochrome,
            foreground: config.asciiColor,
            background: config.backgroundColor,
          },
  });
}
function synchronizeLegacy(config: GradientConfig): void {
  config.effect = "gradient";
  for (const effect of config.effects) {
    if (effect.type === "ascii") {
      if (effect.enabled) config.effect = "ascii";
      config.asciiSize = effect.params.size;
      config.asciiCharacters = effect.params.characters;
      config.asciiColored = effect.params.colored;
      config.asciiInvert = effect.params.invert;
      config.asciiColor = effect.params.foreground;
      config.backgroundColor = effect.params.background;
    } else if (effect.type === "dither") {
      if (effect.enabled) config.effect = "dither";
      config.ditherSize = effect.params.size;
      config.ditherLevels = effect.params.levels;
      config.ditherStrength = effect.params.strength;
      config.ditherPattern = effect.params.pattern;
      config.ditherMonochrome = effect.params.monochrome;
      config.asciiColor = effect.params.foreground;
      config.backgroundColor = effect.params.background;
    }
  }
}
const legacyParameters = {
  ascii: {
    asciiSize: "size",
    asciiCharacters: "characters",
    asciiColored: "colored",
    asciiInvert: "invert",
    asciiColor: "foreground",
    backgroundColor: "background",
  },
  dither: {
    ditherSize: "size",
    ditherLevels: "levels",
    ditherStrength: "strength",
    ditherPattern: "pattern",
    ditherMonochrome: "monochrome",
    asciiColor: "foreground",
    backgroundColor: "background",
  },
} as const;
/** Backward-compatible update boundary. New callers update effects explicitly. */
export function mergeConfig(
  config: GradientConfig,
  patch: Partial<GradientConfig>,
): GradientConfig {
  if (patch.effects !== undefined) return parseConfig({ ...config, ...patch });
  if (patch.effect !== undefined) return parseConfig({ ...config, ...patch, effects: undefined });
  let effects = config.effects;
  for (const type of ["ascii", "dither"] as const) {
    const params: Record<string, unknown> = {};
    for (const [alias, name] of Object.entries(legacyParameters[type])) {
      const value = patch[alias as keyof GradientConfig];
      if (value !== undefined) params[name] = value;
    }
    if (!Object.keys(params).length) continue;
    let index = -1;
    for (let at = effects.length - 1; at >= 0; at--)
      if (effects[at].type === type) {
        index = at;
        break;
      }
    if (index >= 0)
      effects = effects.map((effect, at) =>
        at === index ? parseEffect({ ...effect, params: { ...effect.params, ...params } }) : effect,
      );
  }
  return parseConfig({ ...config, ...patch, effects });
}

export function hexToRgb(hex: string): [number, number, number] {
  if (!isHex(hex)) throw new Error("INVALID_COLOR");
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

export function serializeConfig(config: GradientConfig): string {
  return JSON.stringify({ version: 2, config: parseConfig(config) }, null, 2);
}

export function deserializeConfig(json: string): GradientConfig {
  if (json.length > 65536) throw new Error("CONFIG_TOO_LARGE");
  const data: unknown = JSON.parse(json);
  if (
    !data ||
    typeof data !== "object" ||
    !("version" in data) ||
    (data.version !== 1 && data.version !== 2) ||
    !("config" in data)
  )
    throw new Error("INVALID_VERSION");
  return parseConfig(data.config);
}

/** Seeded palette and composition; preferences and effect settings are preserved. */
export function randomizeConfig(config: GradientConfig, seed: number): GradientConfig {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const hue = next() * 360;
  const color = (h: number, s: number, l: number) => {
    const a = s * Math.min(l, 1 - l);
    const channel = (n: number) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
        .toString(16)
        .padStart(2, "0");
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  };
  return parseConfig({
    ...config,
    seed: Math.abs(seed) % 100000,
    colors: config.colors.map((c, i) => ({
      ...c,
      color: color((hue + i * 32 + next() * 25) % 360, 0.5 + next() * 0.4, 0.15 + i * 0.14),
      enabled: true,
    })),
    rotation: next() * 360,
    centerX: (next() - 0.5) * 0.6,
    centerY: (next() - 0.5) * 0.6,
    stretch: 0.65 + next() * 1.1,
    twist: (next() - 0.5) * 2,
    waveAmplitude: 1 + next() * 7,
    waveFrequencyX: 1 + next() * 5,
    waveFrequencyY: 1 + next() * 5,
    horizontalPressure: 2 + next() * 4,
    verticalPressure: 2 + next() * 4,
    colorBlending: 3 + next() * 4,
    flow: next() * 2,
  });
}
