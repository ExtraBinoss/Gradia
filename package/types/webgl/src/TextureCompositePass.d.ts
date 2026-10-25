import { type BlendMode, type CompositeMode } from "../../core/src/index";
export interface TextureCompositeOptions {
    opacity?: number;
    blendMode?: BlendMode;
    composite?: CompositeMode;
    target?: WebGLFramebuffer | null;
}
/** Composes any two same-context straight RGBA textures. Inputs remain caller-owned.
 * Storage is straight RGBA; alpha compositing uses premultiplied math internally.
 * Color blend modes operate in the texture's encoded color space, as CSS/Canvas do.
 */
export declare class TextureCompositePass {
    private readonly gl;
    private readonly pipeline;
    constructor(gl: WebGLRenderingContext);
    draw(backdrop: WebGLTexture, source: WebGLTexture, width: number, height: number, options?: TextureCompositeOptions): void;
    destroy(): void;
}
