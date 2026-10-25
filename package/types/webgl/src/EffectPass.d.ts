import { type PostEffect } from "../../core/src/index";
/** Ordered GPU image effects. Owns one program, two reusable scratch targets and glyph atlases.
 * Returned textures remain owned by this pass and are valid until resize/destroy or a later apply.
 * Each enabled node adds exactly one draw. Disabled nodes do no GPU work.
 */
export declare class EffectPass {
    private readonly gl;
    private readonly pipeline;
    private readonly fallbackAtlas;
    private readonly atlases;
    private readonly materials;
    private textures;
    private framebuffers;
    private width;
    private height;
    private disposed;
    lastDrawCalls: number;
    constructor(gl: WebGLRenderingContext);
    private material;
    private ensureTargets;
    private releaseTargets;
    private atlas;
    /** Retain both from/to stacks during a live transition, then trim once it finishes. */
    trimAtlases(keep: readonly PostEffect[]): void;
    apply(input: WebGLTexture, effects: readonly PostEffect[], width: number, height: number, phase: number, pixelRatio?: number): WebGLTexture;
    destroy(): void;
}
