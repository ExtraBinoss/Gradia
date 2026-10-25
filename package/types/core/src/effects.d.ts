/** Portable effect definitions. All values are data; no browser, GPU, or editor dependency. */
export declare const effectTypes: readonly ["ascii", "dither", "blocks", "glass", "folds"];
export type EffectType = (typeof effectTypes)[number];
export declare const blendModes: readonly ["normal", "darken", "multiply", "color-burn", "linear-burn", "darker-color", "lighten", "screen", "color-dodge", "linear-dodge", "lighter-color", "overlay", "soft-light", "hard-light", "vivid-light", "linear-light", "pin-light", "hard-mix", "difference", "exclusion", "subtract", "divide", "hue", "saturation", "color", "luminosity"];
export type BlendMode = (typeof blendModes)[number];
export declare const compositeModes: readonly ["source-over", "destination-over", "source-in", "destination-in", "source-out", "destination-out", "source-atop", "destination-atop", "xor", "copy", "destination", "clear", "lighter"];
export type CompositeMode = (typeof compositeModes)[number];
export type EffectScaleMode = "relative" | "pixels";
export declare const MAX_EFFECTS = 32;
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
export type EffectOf<T extends EffectType> = T extends EffectType ? EffectCommon & {
    type: T;
    params: EffectParameterMap[T];
} : never;
export type PostEffect = {
    [T in EffectType]: EffectOf<T>;
}[EffectType];
export type EffectField = {
    kind: "number";
    default: number;
    min: number;
    max: number;
    step: number;
    integer?: boolean;
} | {
    kind: "boolean";
    default: boolean;
} | {
    kind: "color";
    default: string;
} | {
    kind: "text";
    default: string;
} | {
    kind: "select";
    default: string;
    options: readonly string[];
};
export declare const effectFields: Record<EffectType, Record<string, EffectField>>;
export declare function parseEffect(input: unknown): PostEffect;
export declare function createEffect<T extends EffectType>(type: T, id?: string): EffectOf<T>;
/** Array order is execution order: first effect runs on the gradient, last runs on its result. */
export declare function parseEffects(input: unknown): PostEffect[];
