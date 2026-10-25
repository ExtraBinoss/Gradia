import type { GradientConfig } from "@plinka/gradient-core";
import { GradientRenderer } from "@plinka/gradient-webgl";
const cache = new Map<string, string>();
let queue = Promise.resolve(),
  renderer: GradientRenderer | undefined,
  canvas: HTMLCanvasElement | undefined,
  idle: ReturnType<typeof setTimeout> | undefined;
function release() {
  renderer?.destroy();
  canvas?.getContext("webgl")?.getExtension("WEBGL_lose_context")?.loseContext();
  renderer = undefined;
  canvas = undefined;
}
/** One temporary GPU context for a batch; at most 64 previews retained in RAM. */
export function thumbnail(config: GradientConfig): Promise<string> {
  const key = JSON.stringify(config);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    queue = queue
      .then(async () => {
        clearTimeout(idle);
        if (cache.has(key)) {
          resolve(cache.get(key)!);
          idle = setTimeout(release, 500);
          return;
        }
        try {
          if (!renderer) {
            canvas = document.createElement("canvas");
            renderer = new GradientRenderer(canvas, {
              config,
              playing: false,
              width: 320,
              height: 200,
              pixelRatio: 1,
            });
          } else renderer.update(config);
          renderer.seek(0);
          const result = canvas!.toDataURL("image/webp", 0.88);
          cache.set(key, result);
          if (cache.size > 64) cache.delete(cache.keys().next().value!);
          resolve(result);
        } catch (error) {
          release();
          reject(error);
        } finally {
          idle = setTimeout(release, 500);
        }
        await new Promise((done) => setTimeout(done, 0));
      })
      .catch(reject);
  });
}
