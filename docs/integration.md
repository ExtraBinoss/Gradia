# Integrating Gradia

This guide covers the version 2 effect stack. Download the kit from the app instance that produced your preset, or run `bun run build` to generate a matching local kit/package.

The Code dialog exports the full configuration currently shown by the studio, including palette order, shader style, effects and loop duration. React and JavaScript exports do not silently change the preset. JSON exports use `{ "version": 2, "config": ... }`; imports also accept version 1 and migrate its single effect.

## Choose a distribution

| Option                     | Copy                                                           | Imports                                                 | Dependencies               |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- | -------------------------- |
| Plain JavaScript, prebuilt | `gradia/min-js/gradia.min.js`                                  | `GradientRenderer`, core utilities, presets, GPU passes | None                       |
| React, prebuilt            | Full `gradia/` folder from the kit                             | `gradia-react.min.js` and `gradia.min.js`               | React 19+                  |
| TypeScript sources         | `gradient/core`, `gradient/webgl`, optionally `gradient/react` | Relative imports                                        | React only for the adapter |
| Local package installation | `bun add ./path/to/Gradia/package`                             | `@plinka/gradia`, `@plinka/gradia/react`                | React only for the adapter |

The full prebuilt folder includes declarations. If you copy only the minified `.js`, it still works in plain JavaScript. Do not copy only a declaration shim without its sibling `types/` folder. No npm registry publication is assumed.

## Compose an effect stack

```js
import { createEffect, parseConfig, GradientRenderer } from "./gradia/min-js/gradia.min.js";

const blocks = createEffect("blocks", "tiles");
blocks.params.feather = 0.3;
blocks.params.size = 64;

const glass = createEffect("glass", "refraction");
glass.opacity = 0.45;
glass.blendMode = "soft-light";

const config = parseConfig({ style: "silk", effects: [blocks, glass] });
const renderer = new GradientRenderer(canvas, { config });
```

The gradient is the source. `effects: []` renders it alone. Array order is processing order: Blocks receives the gradient, then Glass receives the Blocks result. The editor lists the last applied effect at the top, with the gradient source at the bottom.

Available effect types are `ascii`, `dither`, `blocks`, `glass` and `folds`. Each node has an independent `id`, `params`, `enabled`, `opacity`, `blendMode`, `composite` and `scaleMode`. Repeated types are supported; give them different IDs. `effectFields`, `effectTypes`, `blendModes` and `compositeModes` expose the portable schemas and choices without importing editor code. `createEffect` supplies defaults, and `parseConfig` validates the entire stack.

`blendMode` controls color mixing (26 modes, including Multiply, Screen, Overlay, Soft light, Hue and Luminosity). `composite` controls alpha coverage through all 13 Porter–Duff operators, including `source-over`, `destination-in`, `xor`, `copy`, `clear` and `lighter`. Their effects differ when the source has transparency; ASCII's `backgroundOpacity` and Blocks' gaps can provide it. Disable a node to bypass it without losing its settings.

Sizes default to `scaleMode: "relative"`: `size: 64` means a 64px cell in a 900px-high reference frame. Output resolution and device DPR do not change the composition's cell count. `"pixels"` uses CSS pixels times the renderer's pixel ratio; it is used when migrating legacy presets. Palette, effect order, every parameter and composition setting survive JSON, React/JS code, PNG and deterministic video exports.

The deprecated `effect`, `ascii*` and `dither*` root fields remain migration/update aliases. New integrations should edit `effects` directly. An explicit stack takes precedence, including `effects: []`; use `renderer.update({ effect: "ascii" })` only when intentionally replacing the stack through the old API.

## React

```tsx
"use client";
import { Gradient } from "./gradia/min-js/gradia-react.min.js";
import { presets } from "./gradia/min-js/gradia.min.js";

export function Hero() {
  return (
    <Gradient
      config={presets[0].config}
      transitionDuration={0.65}
      style={{ display: "block", width: "100%", height: 500 }}
    />
  );
}
```

Replace the preset with the complete `config` copied from Code. Mount once. Config changes update the existing renderer. `transitionDuration={0.65}` blends discrete changes; leave it at `0` for a continuous slider or color picker. Cleanup is automatic, including React StrictMode. For Next.js/RSC, keep the consumer in a client component. Importing the module itself does not access the DOM.

Other props: `playing`, `pixelRatio`, `onError`, `onStats` and `rendererRef`. Define the canvas dimensions explicitly. `height: '100%'` needs a parent with a defined height.

## Plain JavaScript

```js
import { GradientRenderer, presets } from "./gradia/min-js/gradia.min.js";

const canvas = document.querySelector("canvas");
const renderer = new GradientRenderer(canvas, { config: presets[0].config });
// Later, in response to a real control or application event:
renderer.update({ brightness: 1.1 });
renderer.transitionTo(presets[4].config, 0.65);
// On teardown, not immediately after mounting:
// renderer.destroy();
```

The Code dialog's JavaScript file creates its own canvas and registers cleanup on `pagehide`, so it can also run directly as a browser module. In a component, use your framework's teardown lifecycle instead.

A direct browser import is available at `https://gradia.plinka.eu/lib/gradia.min.js` with CORS enabled. Vendor the local module for a reproducible production build. The React file uses bare React imports and is intended for a React bundler (or an explicit import map).

## Config and deterministic time

```js
import { deserializeConfig } from "./gradia/min-js/gradia.min.js";
const config = deserializeConfig(await file.text());
renderer.update(config);
renderer.setPlaying(false);
renderer.seek(2.5);
```

`loopDuration` is an integer from 1 to 30 seconds. `speed` is an integer harmonic count; zero freezes the shader. All styles and GPU effects close at the loop boundary. `seek(seconds)`, `time`, `snapshot()`, `setQuality()` and `destroy()` are public APIs. Fixed `width`/`height` options disable auto-resize for exports and thumbnails.

## Blend your own shader outputs

```js
import { TextureBlendPass } from "./gradia/min-js/gradia.min.js";
const blend = new TextureBlendPass(gl);
blend.draw(textureA, textureB, progress, width, height, outputFramebuffer);
// blend.destroy();
```

Both complete input textures must belong to the same WebGL context. Inputs use straight-alpha sRGB colors; blending defaults to linear light with alpha handling. The pass owns its pipeline state and quad/program, not your input textures. Reconfigure GL state for your next pass. `GradientRenderer.transitionTo()` additionally manages live render targets, time, easing, interruptions and lifecycle.

## Compose arbitrary textures

```js
import { TextureCompositePass, EffectPass, createEffect } from "./gradia/min-js/gradia.min.js";

const composite = new TextureCompositePass(gl);
composite.draw(backdropTexture, sourceTexture, width, height, {
  opacity: 0.6,
  blendMode: "screen",
  composite: "source-over",
  target: outputFramebuffer,
});

const effects = new EffectPass(gl);
const stack = [createEffect("blocks", "tiles")];
const outputTexture = effects.apply(sourceTexture, stack, width, height, phase, pixelRatio);
// Consume outputTexture in your next pass, then destroy both passes on teardown.
```

`TextureCompositePass` combines two caller-owned, same-context straight-alpha textures. It performs premultiplied alpha math internally; color blend modes operate in the textures' encoded space, like CSS/Canvas. The output framebuffer must not contain either input texture.

`EffectPass` consumes validated nodes; use `parseEffect` or `parseConfig` after custom edits, and retain the array between animation frames. It owns two reusable scratch textures and its shader/atlas resources. Its returned texture remains pass-owned and can be overwritten by a subsequent `apply`; consume or copy it before that call, resize, or teardown. `phase` is a deterministic loop angle in radians, and `pixelRatio` is only used by pixel-sized nodes. Call `trimAtlases(activeEffects)` when replacing stacks, retaining both stacks while transitioning. Both GPU passes establish their own pipeline state and expose `destroy()`.

## Copying only the engine

Keep `core/` and `webgl/` together, with the relative imports supplied by the kit. Add `react/` only if needed. Do not copy `apps/web`, its CSS, Jotai atoms, shadcn components or the editor's persistence into a consumer app.

Video encoding is an optional adapter in `gradient/video/`. Install `mediabunny` only when using it. The engine and React adapter do not depend on Mediabunny. PNG and the WebGL passes preserve composited alpha. The existing MP4/ordinary WebM video export is opaque; use PNG or the rendering API when transparency is required.
