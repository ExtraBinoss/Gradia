import type { GradientConfig } from "@plinka/gradient-core";
import { GradientRenderer } from "@plinka/gradient-webgl";
export interface VideoOptions {
  width: number;
  height: number;
  fps: number;
  format: "mp4" | "webm";
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}
/** Offline encoding: each frame is explicitly rendered at frame/fps. No screen capture clock. */
export async function encodeVideo(config: GradientConfig, options: VideoOptions): Promise<Blob> {
  const {
    Output,
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    WebMOutputFormat,
    Quality,
    canEncodeVideo,
  } = await import("mediabunny");
  const { width, height, fps, format, signal, onProgress } = options;
  const codec = format === "mp4" ? "avc" : "vp9";
  if (!(await canEncodeVideo(codec, { width, height, frameRate: fps })))
    throw new Error("UNSUPPORTED_CODEC");
  const canvas = document.createElement("canvas");
  const renderer = new GradientRenderer(canvas, {
    config,
    playing: false,
    width,
    height,
    pixelRatio: 1,
    maxPixels: width * height,
  });
  const target = new BufferTarget();
  const output = new Output({
    target,
    format:
      format === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
  });
  const source = new CanvasSource(canvas, {
    codec,
    quality: new Quality("high"),
    keyFrameInterval: 2,
  });
  output.addVideoTrack(source, { frameRate: fps });
  const count = Math.round(config.loopDuration * fps);
  try {
    await output.start();
    for (let frame = 0; frame < count; frame++) {
      signal?.throwIfAborted();
      renderer.seek(frame / fps);
      await source.add(frame / fps, 1 / fps);
      if (frame % 5 === 0) {
        onProgress?.((frame + 1) / count);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    source.close();
    await output.finalize();
    onProgress?.(1);
    if (!target.buffer) throw new Error("EXPORT_FAILED");
    return new Blob([target.buffer], { type: format === "mp4" ? "video/mp4" : "video/webm" });
  } catch (error) {
    await output.cancel();
    throw error;
  } finally {
    renderer.destroy();
    canvas.getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
