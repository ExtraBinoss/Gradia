import { createProgram } from "./gl";
import { postVertex } from "./shaders";
/** Internal reusable full-screen pipeline. Uniform locations and geometry never change. */
export class FullscreenProgram {
  readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private readonly position: number;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private disposed = false;
  constructor(
    readonly gl: WebGLRenderingContext,
    fragment: string,
  ) {
    this.program = createProgram(gl, postVertex, fragment);
    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(this.program);
      throw new Error("WEBGL_RESOURCE_ERROR");
    }
    this.buffer = buffer;
    this.position = gl.getAttribLocation(this.program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
  }
  use(target: WebGLFramebuffer | null, width: number, height: number) {
    if (this.disposed) throw new Error("PASS_DISPOSED");
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1)
      throw new Error("INVALID_DIMENSIONS");
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE);
    gl.colorMask(true, true, true, true);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.position);
    gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 0, 0);
  }
  location(name: string) {
    if (!this.uniforms.has(name))
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniforms.get(name) ?? null;
  }
  float(name: string, value: number) {
    this.gl.uniform1f(this.location(name), value);
  }
  int(name: string, value: number) {
    this.gl.uniform1i(this.location(name), value);
  }
  vec2(name: string, x: number, y: number) {
    this.gl.uniform2f(this.location(name), x, y);
  }
  vec3(name: string, value: Float32List) {
    this.gl.uniform3fv(this.location(name), value);
  }
  vec4(name: string, value: Float32List) {
    this.gl.uniform4fv(this.location(name), value);
  }
  texture(name: string, texture: WebGLTexture, unit: number) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.int(name, unit);
  }
  draw() {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.buffer);
    this.uniforms.clear();
  }
}
