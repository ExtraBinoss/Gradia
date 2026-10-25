export declare function createProgram(gl: WebGLRenderingContext, vertex: string, fragment: string): WebGLProgram;
export declare function mesh(segments: number): {
    vertices: Float32Array;
    indices: Uint16Array;
};
export declare function uploadAtlas(gl: WebGLRenderingContext, texture: WebGLTexture, characters: string): void;
