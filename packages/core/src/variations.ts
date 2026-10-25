import { randomizeConfig, type GradientConfig, type ShaderStyle } from "./config";
const styles: ShaderStyle[] = ["mesh", "silk", "aurora", "liquid", "radial", "waves"];
/** Four reproducible suggestions; no ambient random state or UI dependency. */
export function generateVariations(base: GradientConfig, seed: number): GradientConfig[] {
  return Array.from({ length: 4 }, (_, index) => {
    const next = (Math.imul(seed >>> 0, 1664525) + (index + 1) * 1013904223) >>> 0;
    return {
      ...randomizeConfig(base, next),
      style: index < 2 ? base.style : styles[next % styles.length],
    };
  });
}
