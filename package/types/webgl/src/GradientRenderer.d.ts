import { type GradientConfig } from "../../core/src/index";
export interface RendererStats {
    fps: number;
    width: number;
    height: number;
    drawCalls: number;
}
export interface RendererOptions {
    config?: Partial<GradientConfig>;
    playing?: boolean;
    pixelRatio?: number;
    maxPixels?: number;
    /** Fixed output dimensions for thumbnails or exports. Disables auto-resize. */
    width?: number;
    height?: number;
    respectReducedMotion?: boolean;
    onStats?: (stats: RendererStats) => void;
    onError?: (error: Error) => void;
}
/** Browser adapter. Two steady-state draw calls, no React, store, or per-frame readback. */
export declare class GradientRenderer {
    readonly canvas: HTMLCanvasElement;
    private readonly gl;
    private config;
    private options;
    private programs;
    private buffers;
    private attributes;
    private textures;
    private framebuffer;
    private uniforms;
    private observer?;
    private intersection?;
    private media;
    private frame;
    private last;
    private elapsed;
    private statsStart;
    private frames;
    private playing;
    private visible;
    private disposed;
    private lost;
    private dpr;
    private colorData;
    private influences;
    private activeColors;
    private hueMatrix;
    private materials;
    private transition;
    private blendPass;
    private blendTargets;
    constructor(canvas: HTMLCanvasElement, options?: RendererOptions);
    private initialize;
    private prepareColors;
    private uniform;
    private resize;
    update(patch: Partial<GradientConfig>): void;
    private ensureBlendTargets;
    /** Both shader configurations remain live. Interruptions retain the exact displayed GPU blend. */
    transitionTo(patch: Partial<GradientConfig>, duration?: number): void;
    private invalidate;
    setQuality(pixelRatio: number): void;
    setPlaying(playing: boolean): void;
    get time(): number;
    seek(seconds: number): void;
    render(target?: WebGLFramebuffer | null): void;
    private renderScene;
    private bindBuffer;
    private canAnimate;
    private syncLoop;
    private tick;
    private onVisibility;
    private onLost;
    private onRestored;
    /** Re-renders immediately so preserveDrawingBuffer can stay disabled. */
    snapshot(): Promise<Blob>;
    destroy(): void;
}
