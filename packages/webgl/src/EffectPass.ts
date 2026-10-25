import {
  blendModes,
  compositeModes,
  effectTypes,
  hexToRgb,
  type PostEffect,
} from "@plinka/gradient-core";
import { effectFragment } from "./effects-shaders";
import { FullscreenProgram } from "./fullscreen";
import { uploadAtlas } from "./gl";
interface Material {
  type: number;
  blend: number;
  composite: number;
  size: number;
  aspect: number;
  rotation: number;
  p0: Float32Array<ArrayBuffer>;
  p1: Float32Array<ArrayBuffer>;
  foreground: Float32Array<ArrayBuffer>;
  background: Float32Array<ArrayBuffer>;
  characters?: string;
}
/** Ordered GPU image effects. Owns one program, two reusable scratch targets and glyph atlases.
 * Returned textures remain owned by this pass and are valid until resize/destroy or a later apply.
 * Each enabled node adds exactly one draw. Disabled nodes do no GPU work.
 */
export class EffectPass {
  private readonly pipeline: FullscreenProgram;
  private readonly fallbackAtlas: WebGLTexture;
  private readonly atlases = new Map<string, WebGLTexture>();
  private readonly materials = new WeakMap<PostEffect, Material>();
  private textures: WebGLTexture[] = [];
  private framebuffers: WebGLFramebuffer[] = [];
  private width = 0;
  private height = 0;
  private disposed = false;
  lastDrawCalls = 0;
  constructor(private readonly gl: WebGLRenderingContext) {
    this.pipeline = new FullscreenProgram(gl, effectFragment);
    const fallback = gl.createTexture();
    if (!fallback) {
      this.pipeline.destroy();
      throw new Error("WEBGL_RESOURCE_ERROR");
    }
    this.fallbackAtlas = fallback;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fallback);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  private material(effect: PostEffect): Material {
    const cached = this.materials.get(effect);
    if (cached) return cached;
    const result: Material = {
      type: effectTypes.indexOf(effect.type),
      blend: blendModes.indexOf(effect.blendMode),
      composite: compositeModes.indexOf(effect.composite),
      size: effect.params.size,
      aspect: 1,
      rotation: 0,
      p0: new Float32Array(4),
      p1: new Float32Array(4),
      foreground: new Float32Array(3),
      background: new Float32Array(3),
    };
    if (effect.type === "ascii") {
      const p = effect.params;
      result.characters = p.characters;
      result.p0.set([
        Number(p.colored),
        Number(p.invert),
        p.backgroundOpacity,
        p.characters.length,
      ]);
      result.foreground.set(hexToRgb(p.foreground));
      result.background.set(hexToRgb(p.background));
    } else if (effect.type === "dither") {
      const p = effect.params;
      result.p0.set([
        p.levels,
        p.strength,
        Number(p.monochrome),
        ["bayer4", "bayer8", "noise"].indexOf(p.pattern),
      ]);
      result.foreground.set(hexToRgb(p.foreground));
      result.background.set(hexToRgb(p.background));
    } else if (effect.type === "blocks") {
      const p = effect.params;
      result.aspect = p.aspect;
      result.rotation = (p.rotation * Math.PI) / 180;
      result.p0.set([p.feather, p.gap, p.roundness, p.relief]);
      result.p1[0] = p.variation;
    } else if (effect.type === "glass") {
      const p = effect.params;
      result.rotation = (p.rotation * Math.PI) / 180;
      result.p0.set([p.refraction, p.blur, p.dispersion, p.highlight]);
      result.p1[0] = p.frost;
    } else {
      const p = effect.params;
      result.rotation = (p.rotation * Math.PI) / 180;
      result.p0.set([p.depth, p.softness, p.shadow, p.highlight]);
      result.p1[0] = p.phase;
    }
    this.materials.set(effect, result);
    return result;
  }
  private ensureTargets(width: number, height: number) {
    if (this.width === width && this.height === height && this.textures.length === 2) return;
    this.releaseTargets();
    const gl = this.gl;
    try {
      for (let index = 0; index < 2; index++) {
        const texture = gl.createTexture(),
          framebuffer = gl.createFramebuffer();
        if (texture) this.textures.push(texture);
        if (framebuffer) this.framebuffers.push(framebuffer);
        if (!texture || !framebuffer) throw new Error("WEBGL_RESOURCE_ERROR");
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
          throw new Error("FRAMEBUFFER_ERROR");
      }
      this.width = width;
      this.height = height;
    } catch (error) {
      this.releaseTargets();
      throw error;
    }
  }
  private releaseTargets() {
    for (const texture of this.textures) this.gl.deleteTexture(texture);
    for (const framebuffer of this.framebuffers) this.gl.deleteFramebuffer(framebuffer);
    this.textures = [];
    this.framebuffers = [];
    this.width = 0;
    this.height = 0;
  }
  private atlas(characters: string) {
    const existing = this.atlases.get(characters);
    if (existing) return existing;
    const gl = this.gl,
      texture = gl.createTexture();
    if (!texture) throw new Error("WEBGL_RESOURCE_ERROR");
    try {
      gl.activeTexture(gl.TEXTURE1);
      uploadAtlas(gl, texture, characters);
    } catch (error) {
      gl.deleteTexture(texture);
      throw error;
    }
    this.atlases.set(characters, texture);
    return texture;
  }
  /** Retain both from/to stacks during a live transition, then trim once it finishes. */
  trimAtlases(keep: readonly PostEffect[]) {
    const characters = new Set(
      keep.filter((effect) => effect.type === "ascii").map((effect) => effect.params.characters),
    );
    for (const [key, texture] of this.atlases)
      if (!characters.has(key)) {
        this.gl.deleteTexture(texture);
        this.atlases.delete(key);
      }
  }
  apply(
    input: WebGLTexture,
    effects: readonly PostEffect[],
    width: number,
    height: number,
    phase: number,
    pixelRatio = 1,
  ): WebGLTexture {
    if (this.disposed) throw new Error("PASS_DISPOSED");
    if (!Number.isFinite(phase) || !Number.isFinite(pixelRatio) || pixelRatio <= 0)
      throw new Error("INVALID_EFFECT_CLOCK");
    this.lastDrawCalls = 0;
    let source = input,
      index = 0;
    for (const effect of effects) {
      if (!effect.enabled) continue;
      // Exact identity; also avoids framebuffer quantization and unnecessary shader work.
      if (effect.opacity === 0 && effect.composite === "source-over") continue;
      if (!this.lastDrawCalls) {
        if (
          (source === this.textures[0] || source === this.textures[1]) &&
          (width !== this.width || height !== this.height)
        )
          throw new Error("EFFECT_INPUT_INVALIDATED_BY_RESIZE");
        this.ensureTargets(width, height);
      }
      if (source === this.textures[index]) index = 1 - index;
      const m = this.material(effect),
        p = this.pipeline;
      p.use(this.framebuffers[index], width, height);
      p.texture("u_scene", source, 0);
      p.texture("u_atlas", m.characters ? this.atlas(m.characters) : this.fallbackAtlas, 1);
      p.vec2("u_resolution", width, height);
      p.float("u_phase", phase);
      p.float("u_unit", effect.scaleMode === "relative" ? height / 900 : pixelRatio);
      p.float("u_size", m.size);
      p.float("u_aspect", m.aspect);
      p.float("u_rotation", m.rotation);
      p.vec4("u_p0", m.p0);
      p.vec4("u_p1", m.p1);
      p.vec3("u_foreground", m.foreground);
      p.vec3("u_background", m.background);
      p.float("u_opacity", effect.opacity);
      p.int("u_type", m.type);
      p.int("u_blend", m.blend);
      p.int("u_composite", m.composite);
      p.draw();
      this.lastDrawCalls++;
      source = this.textures[index];
      index = 1 - index;
    }
    return source;
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseTargets();
    this.pipeline.destroy();
    this.gl.deleteTexture(this.fallbackAtlas);
    for (const texture of this.atlases.values()) this.gl.deleteTexture(texture);
    this.atlases.clear();
  }
}
