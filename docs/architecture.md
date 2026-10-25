# Gradia architecture

```text
packages/core/src/    Pure config, validation, presets, deterministic variation generation, history
packages/webgl/src/   Plain WebGL renderer, original shaders, texture blending, GPU resource lifecycle
packages/react/src/   Thin React canvas adapter; no editor UI or store
apps/web/src/         Gradia editor: shadcn Base UI, Jotai, i18next, Motion, persistence, exports
package/min-js/      Generated standalone ESM modules; no source engine copying required
package/types/       Generated declarations for local package and direct-file consumers
scripts/             Build, portable kit, media and performance tooling
```

## Rendering

A fixed indexed 48×48 mesh evaluates an original analytic color field. A second fullscreen pass applies GPU ASCII or dithering, grain and vignette. Programs, buffers and uniform locations are reused. ASCII's glyph atlas is uploaded once and only regenerated when its character set changes. There is no per-frame CPU pixel readback.

`update(patch)` validates config and coalesces repeated updates into the next frame. It does not restart the clock. Materials and hue matrices are cached by config. `transitionTo()` renders two live configurations into reusable targets, then blends in linear light. An interrupted transition retains its current GPU composite in a spare framebuffer. Steady state uses two draws, live transitions five, interrupted transitions three after capture.

Canvas size is bounded by pixel budget and DPR. Visibility, offscreen state, pause, zero speed and reduced-motion preferences stop unnecessary animation. Context restoration rebuilds resources. Teardown deletes resources and observers. The host's GPU and resolution still determine actual FPS.

## Editor state and performance

Jotai owns config, transient preview, hover choice, undo/redo, named-document selection and integration format. Numeric atoms are selected per parameter. Each palette chip subscribes only to its own color; its ordering subscription stays stable during continuous color changes. Effect controls select only appearance-specific fields.

The canvas subscribes imperatively to the store. Renderer time and the MotionValue timeline never stream through React state. Scroll-shadow measurements are grouped into animation frames. Local component state is used for isolated asynchronous image decoding and dialogs, not the shader animation clock.

Thumbnails use one transient, serialized WebGL renderer and a bounded RAM cache. Template captures are requested only when their cards approach the viewport. Decoded captures reveal over a palette, and replacement images retain the old capture until ready. Presets use IndexedDB paging rather than a count limit.

## Exports

PNG and Mediabunny video use dedicated renderers at explicit output dimensions. Video samples `frame / fps` with exact timestamps and backpressure. Editor overlays are not captured. Config JSON is versioned and validated at the boundary.

The Code dialog serializes the current config, never a decorative example. Source/minified imports point to files actually present in the downloadable kit. Generated JavaScript leaves the renderer alive and only destroys it during teardown.

## Verification

`test:coverage` enforces 85% separately across the four metrics of the pure core; current core coverage is recorded by the test run. Browser tests verify shader pixels, loop boundaries, GPU restoration, composition parameters, clipboard contents, minified imports and UI behavior. These are different contracts; browser coverage is not represented as a fictional 85% instrumented GPU metric.

`scripts/measure-performance.ts` records update batching, timeline samples, color input-to-draw CPU latency and lazy-preview readiness in `artifacts/performance.json`. A software WebGL run does not predict hardware FPS. CPU draw-dispatch latency excludes GPU completion.
