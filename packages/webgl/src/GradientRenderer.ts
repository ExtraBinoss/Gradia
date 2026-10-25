import { hexToRgb, parseConfig, mergeConfig, type GradientConfig } from "@plinka/gradient-core";
import { TextureBlendPass } from "./TextureBlendPass";
import { createProgram, mesh } from "./gl";
import { EffectPass } from "./EffectPass";
import { gradientVertex, gradientFragment, postVertex, postFragment } from "./shaders";

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

/** Browser adapter. Source + finishing pass, one extra draw per active effect; no per-frame readback. */
export class GradientRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private config: GradientConfig;
  private options: RendererOptions;
  private programs: WebGLProgram[] = [];
  private buffers: WebGLBuffer[] = [];
  private attributes = new Map<WebGLProgram, number>();
  private textures: WebGLTexture[] = [];
  private framebuffer: WebGLFramebuffer | null = null;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private observer?: ResizeObserver;
  private intersection?: IntersectionObserver;
  private media: MediaQueryList;
  private frame = 0;
  private last = 0;
  private elapsed = 0;
  private statsStart = 0;
  private frames = 0;
  private playing: boolean;
  private visible = true;
  private disposed = false;
  private lost = false;
  private dpr = 1;
  private colorData = new Float32Array(18);
  private influences = new Float32Array(6);
  private activeColors = 0;
  private hueMatrix = new Float32Array(9);
  private materials = new WeakMap<
    GradientConfig,
    {
      colors: Float32Array<ArrayBuffer>;
      influences: Float32Array<ArrayBuffer>;
      hue: Float32Array<ArrayBuffer>;
      count: number;
    }
  >();
  private transition: {
    from: GradientConfig | null;
    fromTime: number;
    started: number;
    clockAt: number;
    duration: number;
  } | null = null;
  private blendPass: TextureBlendPass | null = null;
  private effectPass: EffectPass | null = null;
  private drawCalls = 0;
  private blendTargets: {
    textures: WebGLTexture[];
    framebuffers: WebGLFramebuffer[];
    width: number;
    height: number;
  } | null = null;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    this.canvas = canvas;
    this.options = options;
    this.config = parseConfig(options.config ?? {});
    this.playing = options.playing ?? true;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WEBGL_UNAVAILABLE");
    this.gl = gl;
    this.media = matchMedia("(prefers-reduced-motion: reduce)");
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.media.addEventListener("change", this.onVisibility);
    try {
      this.initialize();
      this.resize();
      if (!options.width) {
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(canvas);
        this.intersection = new IntersectionObserver((entries) => {
          this.visible = entries[0]?.isIntersecting ?? true;
          this.syncLoop();
        });
        this.intersection.observe(canvas);
      }
      this.syncLoop();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  private initialize(): void {
    const gl = this.gl;
    this.programs.push(createProgram(gl, gradientVertex, gradientFragment));
    this.programs.push(createProgram(gl, postVertex, postFragment));
    for (const program of this.programs)
      this.attributes.set(program, gl.getAttribLocation(program, "a_position"));
    const grid = mesh(48);
    for (const [target, data] of [
      [gl.ARRAY_BUFFER, grid.vertices],
      [gl.ELEMENT_ARRAY_BUFFER, grid.indices],
      [gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])],
    ] as const) {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("WEBGL_RESOURCE_ERROR");
      this.buffers.push(buffer);
      gl.bindBuffer(target, buffer);
      gl.bufferData(target, data, gl.STATIC_DRAW);
    }
    for (let i = 0; i < 1; i++) {
      const texture = gl.createTexture();
      if (!texture) throw new Error("WEBGL_RESOURCE_ERROR");
      this.textures.push(texture);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
    for (const key of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_2D, key, gl.LINEAR);
    for (const key of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D, key, gl.CLAMP_TO_EDGE);
    this.framebuffer = gl.createFramebuffer();
    if (!this.framebuffer) throw new Error("WEBGL_RESOURCE_ERROR");
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.textures[0],
      0,
    );
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  private prepareColors(config = this.config): void {
    let material = this.materials.get(config);
    if (!material) {
      const active = config.colors.filter((c) => c.enabled);
      const colors = new Float32Array(18),
        influences = new Float32Array(6);
      active.forEach((color, index) => {
        colors.set(hexToRgb(color.color), index * 3);
        influences[index] = color.influence;
      });
      const angle = (config.hueShift * Math.PI) / 180,
        c = Math.cos(angle),
        t = (1 - c) / 3,
        s = Math.sin(angle) / Math.sqrt(3);
      material = {
        colors,
        influences,
        count: active.length,
        hue: new Float32Array([c + t, t + s, t - s, t - s, c + t, t + s, t + s, t - s, c + t]),
      };
      this.materials.set(config, material);
    }
    this.colorData = material.colors;
    this.influences = material.influences;
    this.activeColors = material.count;
    this.hueMatrix = material.hue;
  }

  private uniform(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    let map = this.uniforms.get(program);
    if (!map) {
      map = new Map();
      this.uniforms.set(program, map);
    }
    if (!map.has(name)) map.set(name, this.gl.getUniformLocation(program, name));
    return map.get(name) ?? null;
  }

  private resize(): void {
    if (this.disposed || this.lost) return;
    const width = this.options.width ?? this.canvas.clientWidth;
    const height = this.options.height ?? this.canvas.clientHeight;
    const maxPixels = this.options.maxPixels ?? 2_000_000;
    this.dpr = Math.min(
      this.options.pixelRatio ?? Math.min(devicePixelRatio || 1, 1.5),
      Math.sqrt(maxPixels / Math.max(1, width * height)),
    );
    const w = Math.max(1, Math.round(width * this.dpr)),
      h = Math.max(1, Math.round(height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      if (this.transition && !this.transition.from) this.transition = null;
    }
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("FRAMEBUFFER_ERROR");
    this.render();
  }

  update(patch: Partial<GradientConfig>): void {
    if (this.disposed) return;
    const config = mergeConfig(this.config, patch);
    this.transition = null;
    const wasAnimating = this.canAnimate();
    this.config = config;
    this.trimEffectAtlases();
    if (this.elapsed > config.loopDuration) this.elapsed %= config.loopDuration;
    if (!this.lost) {
      if (wasAnimating !== this.canAnimate()) this.syncLoop();
      this.invalidate();
    }
  }

  private ensureBlendTargets(): void {
    const gl = this.gl,
      w = this.canvas.width,
      h = this.canvas.height;
    if (this.blendTargets && this.blendTargets.width === w && this.blendTargets.height === h)
      return;
    if (this.blendTargets) {
      for (const texture of this.blendTargets.textures) gl.deleteTexture(texture);
      for (const fb of this.blendTargets.framebuffers) gl.deleteFramebuffer(fb);
    }
    this.blendPass ??= new TextureBlendPass(gl);
    const textures: WebGLTexture[] = [],
      framebuffers: WebGLFramebuffer[] = [];
    // Two live outputs and a spare for interruption snapshots. Never read back to the CPU.
    for (let index = 0; index < 3; index++) {
      const texture = gl.createTexture(),
        fb = gl.createFramebuffer();
      if (!texture || !fb) throw new Error("WEBGL_RESOURCE_ERROR");
      textures.push(texture);
      framebuffers.push(fb);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error("FRAMEBUFFER_ERROR");
    }
    this.blendTargets = { textures, framebuffers, width: w, height: h };
  }
  private trimEffectAtlases() {
    this.effectPass?.trimAtlases([
      ...this.config.effects,
      ...(this.transition?.from?.effects ?? []),
    ]);
  }

  /** Both shader configurations remain live. Interruptions retain the exact displayed GPU blend. */
  transitionTo(patch: Partial<GradientConfig>, duration = 0.65): void {
    if (this.disposed) return;
    if (!Number.isFinite(duration)) throw new Error("INVALID_DURATION");
    const target = mergeConfig(this.config, patch);
    if (
      this.lost ||
      duration <= 0 ||
      (this.options.respectReducedMotion !== false && this.media.matches)
    ) {
      this.update(target);
      return;
    }
    if (JSON.stringify(target) === JSON.stringify(this.config)) return;
    const interrupted = Boolean(this.transition),
      from = this.config,
      fromTime = this.time;
    this.ensureBlendTargets();
    const targets = this.blendTargets!;
    if (interrupted) {
      this.render(targets.framebuffers[2]);
      [targets.textures[0], targets.textures[2]] = [targets.textures[2], targets.textures[0]];
      [targets.framebuffers[0], targets.framebuffers[2]] = [
        targets.framebuffers[2],
        targets.framebuffers[0],
      ];
      this.blendPass!.draw(
        targets.textures[0],
        targets.textures[0],
        0,
        this.canvas.width,
        this.canvas.height,
      );
    }
    this.config = target;
    this.transition = {
      from: interrupted ? null : from,
      fromTime,
      started: performance.now(),
      clockAt: performance.now(),
      duration: Math.max(1, duration * 1000),
    };
    this.trimEffectAtlases();
    this.invalidate();
  }

  private invalidate(): void {
    if (!this.frame && !this.disposed && !this.lost && !document.hidden && this.visible)
      this.frame = requestAnimationFrame(this.tick);
  }

  setQuality(pixelRatio: number): void {
    this.options = { ...this.options, pixelRatio };
    this.resize();
  }
  setPlaying(playing: boolean): void {
    if (this.playing === playing) return;
    this.elapsed = this.time;
    if (this.transition) {
      const now = performance.now();
      if (this.playing && this.transition.from && this.transition.from.speed > 0)
        this.transition.fromTime += (now - this.transition.clockAt) / 1000;
      this.transition.clockAt = now;
    }
    this.playing = playing;
    this.syncLoop();
  }
  get time(): number {
    return this.canAnimate() && this.last
      ? (this.elapsed + (performance.now() - this.last) / 1000) % this.config.loopDuration
      : this.elapsed;
  }
  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) throw new Error("INVALID_TIME");
    this.elapsed = Math.max(0, seconds);
    this.last = this.canAnimate() ? performance.now() : 0;
    this.render();
  }

  render(target: WebGLFramebuffer | null = null): void {
    if (this.disposed || this.lost) return;
    if (!this.canAnimate() && !this.transition && this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    this.drawCalls = 0;
    const state = this.transition;
    if (!state) {
      this.renderScene(this.config, this.elapsed, target);
      return;
    }
    const now = performance.now(),
      position = Math.min(1, (now - state.started) / state.duration),
      mix = position * position * (3 - 2 * position);
    if (position >= 1) {
      this.transition = null;
      this.trimEffectAtlases();
      this.renderScene(this.config, this.elapsed, target);
      return;
    }
    this.ensureBlendTargets();
    const targets = this.blendTargets!;
    if (state.from) {
      const fromTime =
        state.fromTime + (this.playing && state.from.speed > 0 ? (now - state.clockAt) / 1000 : 0);
      this.renderScene(state.from, fromTime, targets.framebuffers[0]);
    }
    this.renderScene(this.config, this.elapsed, targets.framebuffers[1]);
    this.blendPass!.draw(
      targets.textures[0],
      targets.textures[1],
      mix,
      this.canvas.width,
      this.canvas.height,
      target,
    );
    this.drawCalls++;
  }
  private renderScene(c: GradientConfig, elapsed: number, target: WebGLFramebuffer | null): void {
    this.prepareColors(c);
    const gl = this.gl,
      scene = this.programs[0],
      post = this.programs[1];
    const f = (program: WebGLProgram, name: string, value: number) =>
      gl.uniform1f(this.uniform(program, name), value);
    const i = (program: WebGLProgram, name: string, value: number) =>
      gl.uniform1i(this.uniform(program, name), value);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.useProgram(scene);
    this.bindBuffer(scene, this.buffers[0]);
    f(scene, "u_time", ((elapsed % c.loopDuration) / c.loopDuration) * Math.PI * 2);
    f(scene, "u_cycles", Math.max(0, Math.round(c.speed)));
    i(scene, "u_style", ["mesh", "silk", "aurora", "liquid", "radial", "waves"].indexOf(c.style));
    f(scene, "u_seed", c.seed * 0.013);
    f(scene, "u_scale", c.scale);
    gl.uniform2f(this.uniform(scene, "u_center"), c.centerX, c.centerY);
    f(scene, "u_stretch", c.stretch);
    f(scene, "u_twist", c.twist);
    f(scene, "u_rotation", (c.rotation * Math.PI) / 180);
    f(scene, "u_amplitude", c.waveAmplitude);
    f(scene, "u_frequencyX", c.waveFrequencyX);
    f(scene, "u_frequencyY", c.waveFrequencyY);
    f(scene, "u_blending", c.colorBlending * 0.15);
    f(scene, "u_flow", c.flow);
    gl.uniform2f(this.uniform(scene, "u_pressure"), c.horizontalPressure, c.verticalPressure);
    gl.uniform3fv(this.uniform(scene, "u_colors[0]"), this.colorData);
    gl.uniform1fv(this.uniform(scene, "u_influence[0]"), this.influences);
    i(scene, "u_count", this.activeColors);
    f(scene, "u_brightness", c.brightness);
    f(scene, "u_contrast", c.contrast);
    gl.uniformMatrix3fv(this.uniform(scene, "u_hueRotation"), false, this.hueMatrix);
    f(scene, "u_saturation", c.saturation);
    f(scene, "u_shadows", c.shadows);
    f(scene, "u_highlights", c.highlights);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers[1]);
    gl.drawElements(gl.TRIANGLES, 48 * 48 * 6, gl.UNSIGNED_SHORT, 0);
    this.drawCalls++;
    let input = this.textures[0];
    if (c.effects.some((effect) => effect.enabled)) {
      this.effectPass ??= new EffectPass(gl);
      input = this.effectPass.apply(
        input,
        c.effects,
        this.canvas.width,
        this.canvas.height,
        c.speed === 0 ? 0 : ((elapsed % c.loopDuration) / c.loopDuration) * Math.PI * 2,
        this.dpr,
      );
      this.drawCalls += this.effectPass.lastDrawCalls;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.useProgram(post);
    this.bindBuffer(post, this.buffers[2]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input);
    i(post, "u_scene", 0);
    gl.uniform2f(this.uniform(post, "u_resolution"), this.canvas.width, this.canvas.height);
    f(post, "u_dpr", this.dpr);
    f(
      post,
      "u_time",
      c.speed === 0 ? 0 : ((elapsed % c.loopDuration) / c.loopDuration) * Math.PI * 2,
    );
    f(post, "u_grain", c.grain);
    f(post, "u_grainScale", c.grainScale);
    f(post, "u_vignette", c.vignette);
    f(post, "u_chromaticShift", c.chromaticShift);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.drawCalls++;
  }

  private bindBuffer(program: WebGLProgram, buffer: WebGLBuffer): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const position = this.attributes.get(program) ?? 0;
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }

  private canAnimate(): boolean {
    return (
      !this.disposed &&
      !this.lost &&
      this.playing &&
      this.visible &&
      !document.hidden &&
      this.config.speed > 0 &&
      !(this.options.respectReducedMotion !== false && this.media.matches)
    );
  }
  private syncLoop(): void {
    if (
      !this.disposed &&
      !this.lost &&
      this.visible &&
      !document.hidden &&
      (this.canAnimate() || this.transition)
    ) {
      if (!this.frame) {
        this.last = 0;
        this.statsStart = 0;
        this.frames = 0;
        this.invalidate();
      }
    } else {
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
      this.last = 0;
      this.statsStart = 0;
      this.frames = 0;
      this.options.onStats?.({
        fps: 0,
        width: this.canvas.width,
        height: this.canvas.height,
        drawCalls: this.drawCalls,
      });
    }
  }
  private tick = (now: number): void => {
    this.frame = 0;
    if (this.disposed || this.lost || document.hidden || !this.visible) return;
    const animated = this.canAnimate();
    if (animated && this.last)
      this.elapsed = (this.elapsed + (now - this.last) / 1000) % this.config.loopDuration;
    this.last = animated ? now : 0;
    this.render();
    if (animated) {
      this.frames++;
      if (!this.statsStart) this.statsStart = now;
      if (now - this.statsStart >= 1000) {
        this.options.onStats?.({
          fps: Math.round((this.frames * 1000) / (now - this.statsStart)),
          width: this.canvas.width,
          height: this.canvas.height,
          drawCalls: this.drawCalls,
        });
        this.frames = 0;
        this.statsStart = now;
      }
    }
    if (animated || this.transition) this.invalidate();
  };
  private onVisibility = (): void => {
    this.syncLoop();
  };
  private onLost = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
    this.syncLoop();
    this.options.onError?.(new Error("WEBGL_CONTEXT_LOST"));
  };
  private onRestored = (): void => {
    if (this.disposed) return;
    this.lost = false;
    this.transition = null;
    this.blendPass = null;
    this.effectPass = null;
    this.blendTargets = null;
    this.programs = [];
    this.buffers = [];
    this.textures = [];
    this.uniforms.clear();
    this.attributes.clear();
    try {
      this.initialize();
      this.resize();
      this.syncLoop();
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  /** Re-renders immediately so preserveDrawingBuffer can stay disabled. */
  snapshot(): Promise<Blob> {
    if (this.disposed || this.lost) return Promise.reject(new Error("RENDERER_UNAVAILABLE"));
    this.render();
    return new Promise((resolve, reject) =>
      this.canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("EXPORT_FAILED"))),
        "image/png",
      ),
    );
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.intersection?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.media.removeEventListener("change", this.onVisibility);
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    const gl = this.gl;
    for (const program of this.programs) gl.deleteProgram(program);
    for (const buffer of this.buffers) gl.deleteBuffer(buffer);
    for (const texture of this.textures) gl.deleteTexture(texture);
    gl.deleteFramebuffer(this.framebuffer);
    this.blendPass?.destroy();
    this.effectPass?.destroy();
    if (this.blendTargets) {
      for (const texture of this.blendTargets.textures) gl.deleteTexture(texture);
      for (const fb of this.blendTargets.framebuffers) gl.deleteFramebuffer(fb);
    }
    this.uniforms.clear();
    this.attributes.clear();
  }
}
