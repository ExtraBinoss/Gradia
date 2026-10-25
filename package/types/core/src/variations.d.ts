import { type GradientConfig } from "./config";
/** Four reproducible suggestions; no ambient random state or UI dependency. */
export declare function generateVariations(base: GradientConfig, seed: number): GradientConfig[];
