import { type CanvasHTMLAttributes, type RefObject } from "react";
import type { GradientConfig } from "../../core/src/index";
import { GradientRenderer, type RendererOptions } from "../../webgl/src/index";
export interface GradientProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, "onError"> {
    config: GradientConfig;
    playing?: boolean;
    pixelRatio?: number;
    transitionDuration?: number;
    onError?: RendererOptions["onError"];
    onStats?: RendererOptions["onStats"];
    rendererRef?: RefObject<GradientRenderer | null>;
}
/** Mount once, update uniforms. StrictMode-safe cleanup; animation stays outside React. */
export declare function Gradient({ config, playing, pixelRatio, transitionDuration, onError, onStats, rendererRef, ...props }: GradientProps): import("react").JSX.Element;
