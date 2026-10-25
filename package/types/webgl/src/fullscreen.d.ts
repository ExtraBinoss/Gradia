/** Internal reusable full-screen pipeline. Uniform locations and geometry never change. */
export declare class FullscreenProgram {
    readonly gl: WebGLRenderingContext;
    readonly program: WebGLProgram;
    private readonly buffer;
    private readonly position;
    private readonly uniforms;
    private disposed;
    constructor(gl: WebGLRenderingContext, fragment: string);
    use(target: WebGLFramebuffer | null, width: number, height: number): void;
    location(name: string): WebGLUniformLocation | null;
    float(name: string, value: number): void;
    int(name: string, value: number): void;
    vec2(name: string, x: number, y: number): void;
    vec3(name: string, value: Float32List): void;
    vec4(name: string, value: Float32List): void;
    texture(name: string, texture: WebGLTexture, unit: number): void;
    draw(): void;
    destroy(): void;
}
