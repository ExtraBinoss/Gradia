# Gradia architecture

```text
packages/core/src/    Pure config, validation, presets, deterministic variation generation, history
packages/webgl/src/   Plain WebGL renderer, GPU effect stack and compositing, resource lifecycle
packages/react/src/   Thin React canvas adapter; no editor UI or store
apps/web/src/         Gradia editor: shadcn Base UI, Jotai, i18next, Motion, persistence, exports
package/min-js/      Generated standalone ESM modules; no source engine copying required
package/types/       Generated declarations for local package and direct-file consumers
scripts/             Build, portable kit, media and performance tooling
```

## Rendering

A fixed indexed 48×48 mesh evaluates the original gradient field. The canonical `config.effects` array then processes that texture in order. The gradient is an implicit source; an empty array means no post effects. Each node owns its data, ID, visibility, opacity, blend mode, alpha operator, scale mode and parameters. ASCII, dithering, Blocks, Glass and Folds are all fragment-shader effects, with blending and Porter–Duff compositing inside the same pass as the effect.

Two reusable scratch render targets alternate between input and output, avoiding texture feedback and keeping target memory independent of stack length. No DOM layers, CSS filters or CPU pixel processing implement these effects. A final fullscreen pass applies grain, vignette and chromatic shift. Programs, buffers and uniform locations are reused. Effect materials are cached by node; ASCII atlases are shared by character set and retained for both configurations during transitions, then pruned. There is no per-frame CPU pixel readback.

`update(patch)` validates and coalesces repeated updates into the next frame without restarting the clock. The pure `mergeConfig` boundary keeps v1 single-effect update aliases working, while explicit v2 stacks are authoritative. Materials and hue matrices are cached by config. `transitionTo()` renders both complete live stacks into separate outputs and blends them in linear light. An interrupted transition retains its exact visible GPU composite in a spare framebuffer.

The base pipeline uses two draws. Each enabled contributing effect adds one draw; disabled effects and zero-opacity source-over identities are bypassed. A live transition costs `5 + effectsFrom + effectsTo` draws; an interrupted transition using a captured source costs `3 + effectsTo` after capture. The standalone `TextureCompositePass` exposes the same color/alpha formulas for arbitrary textures. `TextureBlendPass` remains the linear-light interpolation API, and `EffectPass` can process a caller's texture without the gradient renderer.

Sizes use a 900px-high reference frame by default, so thumbnails, screen previews and high-resolution exports share the same composition. Pixel-sized legacy nodes retain CSS pixel × DPR semantics. All new shader patterns are deterministic and periodic; the engine owns their clock, never React.

Canvas size is bounded by pixel budget and DPR. Visibility, offscreen state, pause, zero speed and reduced-motion preferences stop unnecessary animation. Context restoration rebuilds resources. Teardown deletes resources and observers. The host's GPU and resolution still determine actual FPS.

## Editor state and performance

Jotai owns config, transient preview, hover choice, undo/redo, named-document selection and integration format. Numeric atoms are selected per parameter. Each palette chip subscribes only to its own color; its ordering subscription stays stable during continuous color changes. Effect rows subscribe only to their order/metadata, and each parameter control selects its own node field. Selecting an effect changes the inspector without rebuilding the renderer. Drag reorder writes one committed ordered stack.

The canvas subscribes imperatively to the store. Renderer time and the MotionValue timeline never stream through React state. Scroll-shadow measurements are grouped into animation frames. Local component state is used for isolated asynchronous image decoding and dialogs, not the shader animation clock.

Thumbnails use one transient, serialized WebGL renderer and a bounded RAM cache. Template captures are requested only when their cards approach the viewport. Decoded captures reveal over a palette, and replacement images retain the old capture until ready. Presets use IndexedDB paging rather than a count limit.

## Exports

PNG and Mediabunny video use dedicated renderers at explicit output dimensions. Video samples `frame / fps` with exact timestamps and backpressure. Editor overlays are not captured. Config JSON is version 2 and validated at the boundary. Version 1 imports migrate the previous exclusive ASCII/Dither mode into an independent node with pixel sizing. Presets, undo/redo, random variations, code exports and both raster/video adapters all use the same canonical config, including the entire ordered stack.

The Code dialog serializes the current config, never a decorative example. Source/minified imports point to files actually present in the downloadable kit. Generated JavaScript leaves the renderer alive and only destroys it during teardown.

## Verification

`test:coverage` enforces 85% separately across the four metrics of the pure core; current core coverage is recorded by the test run. Browser tests verify shader pixels, loop boundaries, GPU restoration, composition parameters, clipboard contents, minified imports and UI behavior. These are different contracts; browser coverage is not represented as a fictional 85% instrumented GPU metric.

`scripts/measure-performance.ts` records update batching, timeline samples, color input-to-draw CPU latency and lazy-preview readiness in `artifacts/performance.json`. A software WebGL run does not predict hardware FPS. CPU draw-dispatch latency excludes GPU completion.

The stack probe in `tests/e2e/effect-resources.spec.ts` records `artifacts/effects-performance.json`: 120 config changes coalesce into one frame, steady edits allocate no GPU resources or atlas uploads, and destruction releases every owned program, shader, buffer, texture and framebuffer. Measurements state the actual adapter and exclude claims about hardware FPS.

For an optional frame-pacing probe, run `GRADIA_NATIVE_GPU=1 bun scripts/profile-effects.ts` with local Chrome and the production preview on port 8411. Without that flag it uses the test browser. The report in `artifacts/effects-runtime-performance.json` records the actual adapter, resolution and warm samples; these are observed frame rates for that machine, not a universal performance guarantee.
