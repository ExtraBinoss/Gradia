import { createProgram } from "./gl";
const vertex = `attribute vec2 a_position;varying vec2 v_uv;void main(){v_uv=a_position*0.5+0.5;gl_Position=vec4(a_position,0.0,1.0);}`;
const fragment = `precision highp float;varying vec2 v_uv;uniform sampler2D u_a,u_b;uniform float u_progress,u_linear;
vec3 decode(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
vec3 encode(vec3 c){return mix(c*12.92,1.055*pow(max(c,0.0),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
void main(){vec4 a=texture2D(u_a,v_uv),b=texture2D(u_b,v_uv);float alpha=mix(a.a,b.a,u_progress);vec3 ca=u_linear>0.5?decode(a.rgb):a.rgb,cb=u_linear>0.5?decode(b.rgb):b.rgb;vec3 color=mix(ca*a.a,cb*b.a,u_progress)/max(alpha,0.000001);if(u_linear>0.5)color=encode(color);gl_FragColor=vec4(color,alpha);}`;
/** Reusable compositor for any two shader output textures in the same WebGL context.
 * Owns its program/quad only. Inputs remain caller-owned. draw() owns GL pipeline state.
 */
export class TextureBlendPass {
  private readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private readonly position: number;
  private readonly a: WebGLUniformLocation | null;
  private readonly b: WebGLUniformLocation | null;
  private readonly progress: WebGLUniformLocation | null;
  private readonly linear: WebGLUniformLocation | null;
  private disposed = false;
  constructor(private readonly gl: WebGLRenderingContext) {
    this.program = createProgram(gl, vertex, fragment);
    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(this.program);
      throw new Error("WEBGL_RESOURCE_ERROR");
    }
    this.buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.position = gl.getAttribLocation(this.program, "a_position");
    this.a = gl.getUniformLocation(this.program, "u_a");
    this.b = gl.getUniformLocation(this.program, "u_b");
    this.progress = gl.getUniformLocation(this.program, "u_progress");
    this.linear = gl.getUniformLocation(this.program, "u_linear");
  }
  draw(
    a: WebGLTexture,
    b: WebGLTexture,
    progress: number,
    width: number,
    height: number,
    target: WebGLFramebuffer | null = null,
    colorSpace: "linear" | "srgb" = "linear",
  ): void {
    if (this.disposed) throw new Error("BLENDER_DISPOSED");
    if (!Number.isFinite(progress)) throw new Error("INVALID_PROGRESS");
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a);
    gl.uniform1i(this.a, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, b);
    gl.uniform1i(this.b, 1);
    gl.uniform1f(this.progress, Math.max(0, Math.min(1, progress)));
    gl.uniform1f(this.linear, colorSpace === "linear" ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.buffer);
  }
}
