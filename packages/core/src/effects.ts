/** Portable effect definitions. All values are data; no browser, GPU, or editor dependency. */
export const effectTypes = ["ascii", "dither", "blocks", "glass", "folds"] as const;
export type EffectType = (typeof effectTypes)[number];
export const blendModes = [
  "normal",
  "darken",
  "multiply",
  "color-burn",
  "linear-burn",
  "darker-color",
  "lighten",
  "screen",
  "color-dodge",
  "linear-dodge",
  "lighter-color",
  "overlay",
  "soft-light",
  "hard-light",
  "vivid-light",
  "linear-light",
  "pin-light",
  "hard-mix",
  "difference",
  "exclusion",
  "subtract",
  "divide",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const;
export type BlendMode = (typeof blendModes)[number];
export const compositeModes = [
  "source-over",
  "destination-over",
  "source-in",
  "destination-in",
  "source-out",
  "destination-out",
  "source-atop",
  "destination-atop",
  "xor",
  "copy",
  "destination",
  "clear",
  "lighter",
] as const;
export type CompositeMode = (typeof compositeModes)[number];
export type EffectScaleMode = "relative" | "pixels";
export const MAX_EFFECTS = 32;

export interface EffectParameterMap {
  ascii: {
    size: number;
    characters: string;
    colored: boolean;
    invert: boolean;
    foreground: string;
    background: string;
    backgroundOpacity: number;
  };
  dither: {
    size: number;
    levels: number;
    strength: number;
    pattern: "bayer4" | "bayer8" | "noise";
    monochrome: boolean;
    foreground: string;
    background: string;
  };
  blocks: {
    size: number;
    aspect: number;
    feather: number;
    gap: number;
    roundness: number;
    relief: number;
    variation: number;
    rotation: number;
  };
  glass: {
    size: number;
    refraction: number;
    blur: number;
    dispersion: number;
    highlight: number;
    frost: number;
    rotation: number;
  };
  folds: {
    size: number;
    depth: number;
    softness: number;
    shadow: number;
    highlight: number;
    rotation: number;
    phase: number;
  };
}
export interface EffectCommon {
  id: string;
  enabled: boolean;
  opacity: number;
  blendMode: BlendMode;
  composite: CompositeMode;
  /** Relative sizes use a 900px-high reference frame, independent of output resolution/DPR. */
  scaleMode: EffectScaleMode;
}
export type EffectOf<T extends EffectType> = T extends EffectType
  ? EffectCommon & {
      type: T;
      params: EffectParameterMap[T];
    }
  : never;
export type PostEffect = { [T in EffectType]: EffectOf<T> }[EffectType];
export type EffectField =
  | { kind: "number"; default: number; min: number; max: number; step: number; integer?: boolean }
  | { kind: "boolean"; default: boolean }
  | { kind: "color"; default: string }
  | { kind: "text"; default: string }
  | { kind: "select"; default: string; options: readonly string[] };
const number = (
  value: number,
  min: number,
  max: number,
  step: number,
  integer = false,
): EffectField => ({ kind: "number", default: value, min, max, step, integer });
const color = (value: string): EffectField => ({ kind: "color", default: value });
export const effectFields: Record<EffectType, Record<string, EffectField>> = {
  ascii: {
    size: number(16, 5, 96, 1),
    characters: { kind: "text", default: " .:-=+*#%@" },
    colored: { kind: "boolean", default: true },
    invert: { kind: "boolean", default: false },
    foreground: color("#d6e7ff"),
    background: color("#10111a"),
    backgroundOpacity: number(1, 0, 1, 0.01),
  },
  dither: {
    size: number(2, 1, 16, 0.5),
    levels: number(4, 2, 16, 1, true),
    strength: number(1, 0, 1, 0.01),
    pattern: { kind: "select", default: "bayer4", options: ["bayer4", "bayer8", "noise"] },
    monochrome: { kind: "boolean", default: false },
    foreground: color("#d6e7ff"),
    background: color("#10111a"),
  },
  blocks: {
    size: number(64, 8, 240, 1),
    aspect: number(1, 0.25, 4, 0.01),
    feather: number(0.18, 0, 1, 0.01),
    gap: number(0, 0, 0.45, 0.01),
    roundness: number(0, 0, 0.5, 0.01),
    relief: number(0.08, -1, 1, 0.01),
    variation: number(0.04, 0, 0.5, 0.01),
    rotation: number(0, -180, 180, 1),
  },
  glass: {
    size: number(44, 8, 240, 1),
    refraction: number(0.6, 0, 2, 0.01),
    blur: number(0.1, 0, 1, 0.01),
    dispersion: number(0.25, 0, 1, 0.01),
    highlight: number(0.25, 0, 1, 0.01),
    frost: number(0.08, 0, 1, 0.01),
    rotation: number(0, -180, 180, 1),
  },
  folds: {
    size: number(180, 16, 480, 1),
    depth: number(0.5, 0, 2, 0.01),
    softness: number(0.25, 0, 1, 0.01),
    shadow: number(0.35, 0, 1, 0.01),
    highlight: number(0.3, 0, 1, 0.01),
    rotation: number(20, -180, 180, 1),
    phase: number(0, 0, 1, 0.01),
  },
};
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("INVALID_EFFECT_NODE");
  return input as Record<string, unknown>;
}
function enumValue<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
  name: string,
): T {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !options.includes(value as T))
    throw new Error(`INVALID_EFFECT_${name}`);
  return value as T;
}
function finite(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("INVALID_EFFECT_NUMBER");
  return Math.max(min, Math.min(max, value));
}
export function parseEffect(input: unknown): PostEffect {
  const source = record(input);
  const type = enumValue(source.type, effectTypes, "ascii", "TYPE");
  if (source.type === undefined) throw new Error("INVALID_EFFECT_TYPE");
  const id = source.id === undefined ? type : source.id;
  if (
    typeof id !== "string" ||
    !id.trim() ||
    id.length > 80 ||
    id === "gradient" ||
    /\p{Cc}/u.test(id)
  )
    throw new Error("INVALID_EFFECT_ID");
  const enabled = source.enabled === undefined ? true : source.enabled;
  if (typeof enabled !== "boolean") throw new Error("INVALID_EFFECT_ENABLED");
  const raw = source.params === undefined ? {} : record(source.params);
  const params: Record<string, number | string | boolean> = {};
  for (const [key, field] of Object.entries(effectFields[type])) {
    const value = raw[key] ?? field.default;
    if (raw[key] === null) throw new Error(`INVALID_EFFECT_${key}`);
    if (field.kind === "number") {
      const parsed = finite(value, field.default, field.min, field.max);
      params[key] = field.integer ? Math.round(parsed) : parsed;
    } else if (field.kind === "boolean") {
      if (typeof value !== "boolean") throw new Error(`INVALID_EFFECT_${key}`);
      params[key] = value;
    } else if (field.kind === "select") {
      params[key] = enumValue(value, field.options, field.default, key);
    } else if (field.kind === "color") {
      if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value))
        throw new Error(`INVALID_EFFECT_${key}`);
      params[key] = value;
    } else {
      if (
        typeof value !== "string" ||
        value.length < 2 ||
        value.length > 32 ||
        /[^\x20-\x7e]/.test(value)
      )
        throw new Error("INVALID_EFFECT_CHARACTERS");
      params[key] = value;
    }
  }
  return {
    id,
    type,
    enabled,
    opacity: finite(source.opacity, 1, 0, 1),
    blendMode: enumValue(source.blendMode, blendModes, "normal", "BLEND"),
    composite: enumValue(source.composite, compositeModes, "source-over", "COMPOSITE"),
    scaleMode: enumValue(source.scaleMode, ["relative", "pixels"] as const, "relative", "SCALE"),
    params,
  } as PostEffect;
}
export function createEffect<T extends EffectType>(type: T, id: string = type): EffectOf<T> {
  return parseEffect({ type, id }) as EffectOf<T>;
}
/** Array order is execution order: first effect runs on the gradient, last runs on its result. */
export function parseEffects(input: unknown): PostEffect[] {
  if (!Array.isArray(input) || input.length > MAX_EFFECTS) throw new Error("INVALID_EFFECT_STACK");
  const ids = new Set<string>();
  return input.map((raw) => {
    const effect = parseEffect(raw);
    if (ids.has(effect.id)) throw new Error("DUPLICATE_EFFECT_ID");
    ids.add(effect.id);
    return effect;
  });
}
