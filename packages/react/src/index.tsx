import { useEffect, useRef, type CanvasHTMLAttributes, type RefObject } from "react";
import type { GradientConfig } from "@plinka/gradient-core";
import { GradientRenderer, type RendererOptions } from "@plinka/gradient-webgl";

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
export function Gradient({
  config,
  playing = true,
  pixelRatio,
  transitionDuration = 0,
  onError,
  onStats,
  rendererRef,
  ...props
}: GradientProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const instance = useRef<GradientRenderer | null>(null);
  const initial = useRef({ config, playing, pixelRatio, onError, onStats, rendererRef });
  useEffect(() => {
    if (!canvas.current) return;
    const options = initial.current;
    try {
      const renderer = new GradientRenderer(canvas.current, options);
      instance.current = renderer;
      if (options.rendererRef) options.rendererRef.current = renderer;
      return () => {
        renderer.destroy();
        instance.current = null;
        if (options.rendererRef) options.rendererRef.current = null;
      };
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);
  useEffect(() => {
    if (transitionDuration > 0) instance.current?.transitionTo(config, transitionDuration);
    else instance.current?.update(config);
  }, [config, transitionDuration]);
  useEffect(() => {
    instance.current?.setPlaying(playing);
  }, [playing]);
  useEffect(() => {
    if (pixelRatio !== undefined) instance.current?.setQuality(pixelRatio);
  }, [pixelRatio]);
  return <canvas {...props} ref={canvas} />;
}
