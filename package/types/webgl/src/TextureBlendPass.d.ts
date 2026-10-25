/** Reusable compositor for any two shader output textures in the same WebGL context.
 * Owns its program/quad only. Inputs remain caller-owned. draw() owns GL pipeline state.
 */
export declare class TextureBlendPass {
    private readonly gl;
    private readonly program;
    private readonly buffer;
    private readonly position;
    private readonly a;
    private readonly b;
    private readonly progress;
    private readonly linear;
    private disposed;
    constructor(gl: WebGLRenderingContext);
    draw(a: WebGLTexture, b: WebGLTexture, progress: number, width: number, height: number, target?: WebGLFramebuffer | null, colorSpace?: "linear" | "srgb"): void;
    destroy(): void;
}
