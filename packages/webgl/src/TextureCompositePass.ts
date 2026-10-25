import {
  blendModes,
  compositeModes,
  type BlendMode,
  type CompositeMode,
} from "@plinka/gradient-core";
import { compositingGLSL } from "./compositing";
import { FullscreenProgram } from "./fullscreen";
const fragment = `precision highp float;
varying vec2 v_uv;uniform sampler2D u_backdrop,u_source;
uniform float u_opacity;uniform int u_blend,u_composite;
${compositingGLSL}
void main(){gl_FragColor=composeRGBA(texture2D(u_backdrop,v_uv),texture2D(u_source,v_uv),u_opacity,u_blend,u_composite);}`;
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
export class TextureCompositePass {
  private readonly pipeline: FullscreenProgram;
  constructor(private readonly gl: WebGLRenderingContext) {
    this.pipeline = new FullscreenProgram(gl, fragment);
  }
  draw(
    backdrop: WebGLTexture,
    source: WebGLTexture,
    width: number,
    height: number,
    options: TextureCompositeOptions = {},
  ) {
    const opacity = options.opacity ?? 1;
    const blend = blendModes.indexOf(options.blendMode ?? "normal");
    const composite = compositeModes.indexOf(options.composite ?? "source-over");
    if (!Number.isFinite(opacity)) throw new Error("INVALID_OPACITY");
    if (blend < 0 || composite < 0) throw new Error("INVALID_COMPOSITE_MODE");
    const gl = this.gl,
      p = this.pipeline;
    p.use(options.target ?? null, width, height);
    if (options.target) {
      const attachment = gl.getFramebufferAttachmentParameter(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME,
      );
      if (attachment === source || attachment === backdrop)
        throw new Error("TEXTURE_FEEDBACK_LOOP");
    }
    p.texture("u_backdrop", backdrop, 0);
    p.texture("u_source", source, 1);
    p.float("u_opacity", Math.max(0, Math.min(1, opacity)));
    p.int("u_blend", blend);
    p.int("u_composite", composite);
    p.draw();
  }
  destroy() {
    this.pipeline.destroy();
  }
}
