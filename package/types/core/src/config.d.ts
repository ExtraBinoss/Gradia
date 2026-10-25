import { type PostEffect } from "./effects";
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
export declare const ranges: {
    readonly seed: readonly [0, 99999];
    readonly speed: readonly [0, 10];
    readonly loopDuration: readonly [1, 30];
    readonly scale: readonly [0.3, 4];
    readonly rotation: readonly [0, 360];
    readonly centerX: readonly [-1, 1];
    readonly centerY: readonly [-1, 1];
    readonly stretch: readonly [0.25, 3];
    readonly twist: readonly [-3, 3];
    readonly contrast: readonly [0.25, 2.5];
    readonly hueShift: readonly [-180, 180];
    readonly chromaticShift: readonly [0, 0.04];
    readonly waveAmplitude: readonly [0, 10];
    readonly waveFrequencyX: readonly [0, 10];
    readonly waveFrequencyY: readonly [0, 10];
    readonly colorBlending: readonly [0.2, 10];
    readonly horizontalPressure: readonly [0.5, 10];
    readonly verticalPressure: readonly [0.5, 10];
    readonly flow: readonly [0, 3];
    readonly brightness: readonly [0.2, 2];
    readonly saturation: readonly [0, 2];
    readonly shadows: readonly [0, 10];
    readonly highlights: readonly [0, 10];
    readonly grain: readonly [0, 1];
    readonly grainScale: readonly [0.5, 5];
    readonly vignette: readonly [0, 1];
    readonly asciiSize: readonly [5, 40];
    readonly ditherSize: readonly [1, 12];
    readonly ditherLevels: readonly [2, 16];
    readonly ditherStrength: readonly [0, 1];
};
export type NumericParameter = keyof typeof ranges;
export declare const DEFAULT_CONFIG: GradientConfig;
export declare function isHex(value: unknown): value is string;
/** Strict at storage/import boundaries. No DOM, UI, time or random globals. */
export declare function parseConfig(input: unknown): GradientConfig;
/** Backward-compatible update boundary. New callers update effects explicitly. */
export declare function mergeConfig(config: GradientConfig, patch: Partial<GradientConfig>): GradientConfig;
export declare function hexToRgb(hex: string): [number, number, number];
export declare function serializeConfig(config: GradientConfig): string;
export declare function deserializeConfig(json: string): GradientConfig;
/** Seeded palette and composition; preferences and effect settings are preserved. */
export declare function randomizeConfig(config: GradientConfig, seed: number): GradientConfig;
